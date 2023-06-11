// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"fmt"
	"math"
	"reflect"
	"strconv"
	"time"

	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
	"gopkg.in/guregu/null.v4"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost/server/public/model"
)

type StatsStore struct {
	pluginAPI PluginAPIClient
	store     *SQLStore
}

func NewStatsStore(pluginAPI PluginAPIClient, sqlStore *SQLStore) *StatsStore {
	return &StatsStore{
		pluginAPI: pluginAPI,
		store:     sqlStore,
	}
}

type StatsFilters struct {
	TeamID     string
	PlaybookID string
}

func applyFilters(query sq.SelectBuilder, filters *StatsFilters) sq.SelectBuilder {
	ret := query

	if filters.TeamID != "" {
		ret = ret.Where(sq.Eq{"i.TeamID": filters.TeamID})
	}
	if filters.PlaybookID != "" {
		ret = ret.Where(sq.Eq{"i.PlaybookID": filters.PlaybookID})
	}

	return ret
}

func (s *StatsStore) TotalInProgressPlaybookRuns(filters *StatsFilters) int {
	query := s.store.builder.
		Select("COUNT(i.ID)").
		From("IR_Incident as i").
		Where("i.EndAt = 0")

	query = applyFilters(query, filters)

	var total int
	if err := s.store.getBuilder(s.store.db, &total, query); err != nil {
		logrus.WithError(err).Error("failed to query total in progress playbook runs")
		return -1
	}

	return total
}

// TotalPlaybooks returns the number of playbooks in the server
func (s *StatsStore) TotalPlaybooks() (int, error) {
	query := s.store.builder.
		Select("COUNT(p.ID)").
		From("IR_Playbook as p")

	var total int
	if err := s.store.getBuilder(s.store.db, &total, query); err != nil {
		return 0, errors.Wrap(err, "Error retrieving total playbooks stat")
	}

	return total, nil
}

// TotalPlaybookRuns returns the number of playbook runs in the server
func (s *StatsStore) TotalPlaybookRuns() (int, error) {
	query := s.store.builder.
		Select("COUNT(i.ID)").
		From("IR_Incident as i")

	var total int
	if err := s.store.getBuilder(s.store.db, &total, query); err != nil {
		return 0, errors.Wrap(err, "Error retrieving total runs stat")
	}

	return total, nil
}

func (s *StatsStore) TotalActiveParticipants(filters *StatsFilters) int {
	query := s.store.builder.
		Select("COUNT(DISTINCT rp.UserId)").
		From("IR_Run_Participants as rp").
		Join("IR_Incident AS i ON i.ID = rp.IncidentID").
		Where("i.EndAt = 0").
		Where("rp.IsParticipant = true").
		Where(sq.Expr("rp.UserId NOT IN (SELECT UserId FROM Bots)"))

	query = applyFilters(query, filters)

	var total int
	if err := s.store.getBuilder(s.store.db, &total, query); err != nil {
		logrus.WithError(err).Error("failed to query total active participants")
		return -1
	}

	return total
}

// RunsFinishedBetweenDays are calculated from startDay to endDay (inclusive), where "days"
// are "number of days ago". E.g., for the last 30 days, begin day would be 30 (days ago), end day
// would be 0 (days ago) (up until now).
func (s *StatsStore) RunsFinishedBetweenDays(filters *StatsFilters, startDay, endDay int) int {
	dayInMS := int64(86400000)
	startInMS := beginningOfTodayMillis() - int64(startDay)*dayInMS
	endInMS := endOfTodayMillis() - int64(endDay)*dayInMS

	query := s.store.builder.
		Select("COUNT(i.Id) as Count").
		From("IR_Incident as i").
		Where(sq.And{
			sq.Expr("i.EndAt > ?", startInMS),
			sq.Expr("i.EndAt <= ?", endInMS),
		})
	query = applyFilters(query, filters)

	var total int
	if err := s.store.getBuilder(s.store.db, &total, query); err != nil {
		logrus.WithError(err).Error("failed to query runs finished between days")
		return -1
	}

	return total
}

// Not efficient. One query per day.
func (s *StatsStore) MovingWindowQueryActive(query sq.SelectBuilder, numDays int) ([]int, error) {
	now := model.GetMillis()
	dayInMS := int64(86400000)

	results := []int{}
	for i := 0; i < numDays; i++ {
		modifiedQuery := query.Where(
			sq.Expr(
				`i.CreateAt < ? AND (i.EndAt > ? OR i.EndAt = 0)`,
				now-(int64(i)*dayInMS),
				now-(int64(i+1)*dayInMS),
			),
		)

		var value int
		if err := s.store.getBuilder(s.store.db, &value, modifiedQuery); err != nil {
			return nil, err
		}

		results = append(results, value)
	}

	return results, nil
}

// RunsStartedPerWeekLastXWeeks returns the number of runs started each week for the last X weeks.
// Returns data in order of oldest week to most recent week.
func (s *StatsStore) RunsStartedPerWeekLastXWeeks(x int, filters *StatsFilters) ([]int, [][]int64) {
	day := int64(86400000)
	week := day * 7
	startOfWeek := beginningOfLastSundayMillis()
	endOfWeek := startOfWeek + week - 1
	var weeksStartAndEnd [][]int64

	q := s.store.builder.Select()
	for i := 0; i < x; i++ {
		if s.store.db.DriverName() == model.DatabaseDriverMysql {
			q = q.Column(`
			CAST(
				COALESCE(
					 SUM(
						 CASE
							 WHEN i.CreateAt >= ? AND i.CreateAt < ?
								 THEN 1
							 ELSE 0
						 END)
				, 0)
				 AS UNSIGNED)
				 `, startOfWeek, endOfWeek)
		} else {
			q = q.Column(`
			COALESCE(
				 SUM(CASE
					WHEN i.CreateAt >= ? AND i.CreateAt < ?
						THEN 1
					ELSE 0
				END)
			, 0)
                 `, startOfWeek, endOfWeek)
		}

		weeksStartAndEnd = append(weeksStartAndEnd, []int64{startOfWeek, endOfWeek})

		endOfWeek -= week
		startOfWeek -= week
	}

	q = q.From("IR_Incident as i")
	q = applyFilters(q, filters)

	counts, err := s.performQueryForXCols(q, x)
	if err != nil {
		logrus.WithError(err).WithField("x", x).Error("failed to query runs started per week last x weeks")
		return []int{}, [][]int64{}
	}

	reverseSlice(counts)
	reverseSlice(weeksStartAndEnd)

	return counts, weeksStartAndEnd
}

// ActiveRunsPerDayLastXDays returns the number of active runs per day for the last X days.
// Returns data in order of oldest day to most recent day.
func (s *StatsStore) ActiveRunsPerDayLastXDays(x int, filters *StatsFilters) ([]int, [][]int64) {
	startOfDay := beginningOfTodayMillis()
	endOfDay := endOfTodayMillis()
	day := int64(86400000)
	var daysAsStartAndEnd [][]int64

	q := s.store.builder.Select()
	for i := 0; i < x; i++ {
		// a playbook run was active if it was created before the end of the day and ended after the
		// start of the day (or still active)
		if s.store.db.DriverName() == model.DatabaseDriverMysql {
			q = q.Column(`
			CAST(
				COALESCE(
					 SUM(
						 CASE
							 WHEN (i.EndAt >= ? OR i.EndAt = 0) AND i.CreateAt < ?
								 THEN 1
							 ELSE 0
						 END)
				, 0)
				 AS UNSIGNED)
                `, startOfDay, endOfDay)
		} else {
			q = q.Column(`
			COALESCE(
				SUM(CASE
					WHEN (i.EndAt >= ? OR i.EndAt = 0) AND i.CreateAt < ?
						THEN 1
					ELSE 0
				END)
			, 0)
                `, startOfDay, endOfDay)
		}

		daysAsStartAndEnd = append(daysAsStartAndEnd, []int64{startOfDay, endOfDay})

		endOfDay -= day
		startOfDay -= day
	}

	q = q.From("IR_Incident as i")
	q = applyFilters(q, filters)

	counts, err := s.performQueryForXCols(q, x)
	if err != nil {
		logrus.WithError(err).WithField("x", x).Error("failed to query active runs per day last x days")
		return []int{}, [][]int64{}
	}

	reverseSlice(counts)
	reverseSlice(daysAsStartAndEnd)

	return counts, daysAsStartAndEnd
}

// ActiveParticipantsPerDayLastXDays returns the number of active participants per day for the last X days.
// Returns data in order of oldest day to most recent day.
func (s *StatsStore) ActiveParticipantsPerDayLastXDays(x int, filters *StatsFilters) ([]int, [][]int64) {
	startOfDay := beginningOfTodayMillis()
	endOfDay := endOfTodayMillis()
	day := int64(86400000)
	var daysAsTimes [][]int64

	q := s.store.builder.Select()
	for i := 0; i < x; i++ {
		// COUNT( DISTINCT( CASE: the CASE will return the userId if the row satisfies the conditions,
		// therefore COUNT( DISTINCT will return the number of unique userIds
		//
		// first two lines of the WHEN: a playbook run was active if it was ended after the start of
		// the day (or still active) and created before the end of the day
		//
		// second two lines: a user was active in the same way--if they left after the start of
		// the day (or are still in the channel) and joined before the end of the day
		q = q.Column(`
				COALESCE(
					COUNT(DISTINCT
						  (CASE
							   WHEN (i.EndAt >= ? OR i.EndAt = 0) AND
									i.CreateAt < ? AND
									(cmh.LeaveTime >= ? OR cmh.LeaveTime is NULL) AND
									cmh.JoinTime < ?
								   THEN cmh.UserId
						  END))
				, 0)
                `, startOfDay, endOfDay, startOfDay, endOfDay)

		daysAsTimes = append(daysAsTimes, []int64{startOfDay, endOfDay})

		endOfDay -= day
		startOfDay -= day
	}

	q = q.
		From("IR_Incident as i").
		InnerJoin("ChannelMemberHistory as cmh ON i.ChannelId = cmh.ChannelId").
		Where(sq.Expr("cmh.UserId NOT IN (SELECT UserId FROM Bots)"))
	q = applyFilters(q, filters)

	counts, err := s.performQueryForXCols(q, x)
	if err != nil {
		logrus.WithError(err).WithField("x", x).Error("failed to query active participants per day last x days")
		return []int{}, [][]int64{}
	}

	reverseSlice(counts)
	reverseSlice(daysAsTimes)

	return counts, daysAsTimes
}

// MetricOverallAverage for a specific playbook returns a list that contains an average value for each metric.
// Only published metrics values are included.
// Returns empty list when Playbook doesn't have configured metrics
// If for some metrics there are no published values, the corresponding element will be nil in the resulting slice
func (s *StatsStore) MetricOverallAverage(filters StatsFilters) []null.Int {
	// this query will return average values only for the metrics that have published data in the database
	// so we need to add to the result array nil values for metrics that don't have data
	query := s.store.builder.
		Select("mc.ID as ID, FLOOR(AVG(m.Value)) as Value").
		From("IR_Metric as m").
		InnerJoin("IR_MetricConfig as mc ON m.MetricConfigID = mc.ID").
		Where(sq.Eq{"mc.PlaybookID": filters.PlaybookID}).
		Where(sq.Eq{"m.Published": true}).
		GroupBy("mc.ID").
		OrderBy("mc.Ordering ASC")

	type Average struct {
		ID    string
		Value string
	}
	var averages []Average
	if err := s.store.selectBuilder(s.store.db, &averages, query); err != nil {
		logrus.WithError(err).Error("failed to query metric averages")
		return []null.Int{}
	}

	configs, err := s.retrieveMetricConfigs(filters.PlaybookID)
	if err != nil {
		logrus.WithError(err).WithField("playbook_id", filters.PlaybookID).Error("Error retrieving metrics configs ids for playbook")
		return []null.Int{}
	}

	// use metrics configurations to build a result array, where overallAverage[i] will be average value for
	// the i-th metric or nil if there is no data in the database for this specific metric
	overallAverage := make([]null.Int, len(configs))
	for i, id := range configs {
		for _, av := range averages {
			if av.ID == id {
				val, _ := strconv.ParseInt(av.Value, 10, 64)
				overallAverage[i] = null.IntFrom(val)
				break
			}
		}
	}
	return overallAverage
}

// MetricValueRange returns min and max values for each metric
// Only published metrics are included.
// If there are no configured metrics, returns an empty list
// If for some metrics there are no published values, the corresponding slice will be nil in the resulting slice
func (s *StatsStore) MetricValueRange(filters StatsFilters) [][]int64 {
	type MinMax struct {
		ID  string
		Min int64
		Max int64
	}

	// this query will return min-max values only for the metrics that have published data in the database
	// so we need to add to the result array nil values for metrics that don't have data
	q := s.store.builder.
		Select("mc.ID as ID, MIN(Value) as Min, MAX(Value) as Max").
		From("IR_Metric as m").
		InnerJoin("IR_MetricConfig as mc ON m.MetricConfigID = mc.ID").
		Where(sq.Eq{"mc.PlaybookID": filters.PlaybookID}).
		Where(sq.Eq{"m.Published": true}).
		GroupBy("mc.ID").
		OrderBy("mc.Ordering ASC")
	var res []MinMax
	if err := s.store.selectBuilder(s.store.db, &res, q); err != nil {
		logrus.WithError(err).Error("Error retrieving metric min and max values")
		return [][]int64{}
	}

	configs, err := s.retrieveMetricConfigs(filters.PlaybookID)
	if err != nil {
		logrus.WithError(err).WithField("playbook_id", filters.PlaybookID).Error("Error retrieving metrics configs ids for playbook")
		return [][]int64{}
	}

	// use metrics configurations to build a result array, where valueRange[i] will be min-max values for
	// the i-th metric or nil if there is no data in the database for this specific metric
	valueRange := make([][]int64, len(configs))
	for i, id := range configs {
		for _, minMax := range res {
			if minMax.ID == id {
				valueRange[i] = []int64{minMax.Min, minMax.Max}
				break
			}
		}
	}

	return valueRange
}

// MetricRollingValuesLastXRuns for each metric returns list of last `x` published values, starting from `offset`
// first element in the list is most recent. And returns the names of the last `x` runs.
// Returns empty list if Playbook doesn't have metrics.
// If for some metrics there are no published values, the corresponding slice will be nil in the resulting slice
func (s *StatsStore) MetricRollingValuesLastXRuns(x int, offset int, filters StatsFilters) ([][]int64, []string) {
	logger := logrus.WithField("playbook_id", filters.PlaybookID)

	// retrieve metric configs metricsConfigsIDs for playbook
	metricsConfigsIDs, err := s.retrieveMetricConfigs(filters.PlaybookID)
	if err != nil {
		logger.WithError(err).Error("failed to retrieve metrics configs")
		return [][]int64{}, []string{}
	}

	//NOTE: It would be possible to turn this into a single statement; keep in mind if the playbookStats call becomes slow
	metricsValues := make([][]int64, 0)
	runNames := make([]string, 0)

	for _, id := range metricsConfigsIDs {
		query := s.store.builder.
			Select("m.Value AS Value", "c.DisplayName AS Name").
			From("IR_Incident as i").
			Join("Channels AS c ON (c.Id = i.ChannelId)").
			InnerJoin("IR_Metric AS m ON (i.ID = m.IncidentID)").
			Where(sq.Eq{"i.PlaybookID": filters.PlaybookID}).
			Where("i.RetrospectivePublishedAt > 0").
			Where(sq.Eq{"i.RetrospectiveWasCanceled": false}).
			Where(sq.Eq{"m.MetricConfigID": id}).
			OrderBy("i.RetrospectivePublishedAt DESC").
			Limit(uint64(x)).
			Offset(uint64(offset))

		var rows []struct {
			Value int64
			Name  string
		}
		if err := s.store.selectBuilder(s.store.db, &rows, query); err != nil {
			logger.WithError(err).WithField("metric_config_id", id).Error("failed to query metrics")
			return [][]int64{}, []string{}
		}

		var values []int64
		var names []string
		for _, r := range rows {
			values = append(values, r.Value)
			names = append(names, r.Name)
		}

		metricsValues = append(metricsValues, values)
		runNames = names // overwrites, but it'll be the same data each time -- simpler than making a separate query
	}

	return metricsValues, runNames
}

// MetricRollingAverageAndChange for each metric returns average of last `x` published values and
// change with comparison to the previous period
// returns empty list if the Playbook doesn't have metrics
// If for some metrics there are no published values, the corresponding element will be nil in the resulting slice
func (s *StatsStore) MetricRollingAverageAndChange(x int, filters StatsFilters) (metricRollingAverage []null.Int, metricRollingAverageChange []null.Int) {
	metricValuesWholePeriod, _ := s.MetricRollingValuesLastXRuns(2*x, 0, filters)

	if len(metricValuesWholePeriod) == 0 {
		return []null.Int{}, []null.Int{}
	}

	metricRollingAverage = make([]null.Int, 0)
	metricRollingAverageChange = make([]null.Int, 0)
	for i, nums := range metricValuesWholePeriod {
		firstPeriodEnd := int(math.Min(float64(x), float64(len(nums))))
		// add null values when there are no metric values available
		if firstPeriodEnd == 0 {
			metricRollingAverage = append(metricRollingAverage, null.NewInt(0, false))
			metricRollingAverageChange = append(metricRollingAverageChange, null.NewInt(0, false))
			continue
		}

		metricRollingAverage = append(metricRollingAverage, null.IntFrom(getAverage(nums[:firstPeriodEnd])))

		secondPeriodEnd := int(math.Min(float64(2*x), float64(len(nums))))
		// add null value when change can't be calculated
		if firstPeriodEnd >= secondPeriodEnd || metricRollingAverage[i].IsZero() {
			metricRollingAverageChange = append(metricRollingAverageChange, null.NewInt(0, false))
			continue
		}
		diff := metricRollingAverage[i].Int64*100/getAverage(nums[firstPeriodEnd:secondPeriodEnd]) - 100
		metricRollingAverageChange = append(metricRollingAverageChange, null.IntFrom(diff))
	}
	return
}

func (s *StatsStore) performQueryForXCols(q sq.SelectBuilder, x int) ([]int, error) {
	sqlString, args, err := q.ToSql()
	if err != nil {
		return []int{}, errors.Wrap(err, "failed to build sql")
	}
	sqlString = s.store.db.Rebind(sqlString)

	rows, err := s.store.db.Queryx(sqlString, args...)
	if err != nil {
		return []int{}, errors.Wrap(err, "failed to get rows from Queryx")
	}

	defer rows.Close()
	if !rows.Next() {
		return []int{}, errors.Wrap(rows.Err(), "failed to get rows.Next()")
	}

	cols, err2 := rows.SliceScan()
	if err2 != nil {
		return []int{}, errors.Wrap(err, "failed to get SliceScan")
	}
	if len(cols) != x {
		return []int{}, fmt.Errorf("failed to get correct length for columns, wanted %d, got %d", x, len(cols))
	}

	counts := make([]int, x)
	for i := 0; i < x; i++ {
		val, ok := cols[i].(int64)
		if !ok {
			return []int{}, fmt.Errorf("column was unexpected type, wanted int64, got: %T", cols[i])
		}
		counts[i] = int(val)
	}

	return counts, nil
}

func (s *StatsStore) retrieveMetricConfigs(playbookID string) ([]string, error) {
	query := s.store.builder.
		Select("ID").
		From("IR_MetricConfig").
		Where(sq.Eq{"PlaybookID": playbookID}).
		Where(sq.Eq{"DeleteAt": 0}).
		OrderBy("Ordering ASC")
	var ids []string
	if err := s.store.selectBuilder(s.store.db, &ids, query); err != nil {
		return nil, err
	}

	return ids, nil
}

func beginningOfTodayMillis() int64 {
	year, month, day := time.Now().UTC().Date()
	bod := time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
	return bod.UnixNano() / int64(time.Millisecond)
}

func endOfTodayMillis() int64 {
	year, month, day := time.Now().UTC().Add(24 * time.Hour).Date()
	bod := time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
	return bod.UnixNano()/int64(time.Millisecond) - 1
}

func beginningOfLastSundayMillis() int64 {
	// Weekday is an iota where Sun = 0, Mon = 1, etc. So this is an offset to get back to Sun.
	offset := int(time.Now().UTC().Weekday())
	now := time.Now().UTC()
	startOfSunday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, -offset)
	return startOfSunday.UnixNano() / int64(time.Millisecond)
}

func reverseSlice(s interface{}) {
	value := reflect.ValueOf(s)
	if value.Kind() != reflect.Slice {
		panic(errors.New("s must be a slice type"))
	}
	n := reflect.ValueOf(s).Len()
	swap := reflect.Swapper(s)
	for i, j := 0, n-1; i < j; i, j = i+1, j-1 {
		swap(i, j)
	}
}

func getAverage(nums []int64) int64 {
	var sum int64
	for _, num := range nums {
		sum += num
	}
	return sum / int64(len(nums))
}
