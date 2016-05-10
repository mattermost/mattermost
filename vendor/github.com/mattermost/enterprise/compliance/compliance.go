// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package compliance

import (
	"archive/zip"
	"encoding/csv"
	"encoding/json"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	l4g "github.com/alecthomas/log4go"

	"github.com/mattermost/platform/api"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

var crsFileMutex sync.Mutex

type ComplianceInterfaceImpl struct {
}

func init() {
	einterfaces.RegisterComplianceInterface(&ComplianceInterfaceImpl{})
}

func Unzip(archive, target string) error {
	reader, err := zip.OpenReader(archive)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(target, 0755); err != nil {
		return err
	}

	for _, file := range reader.File {
		path := filepath.Join(target, file.Name)
		if file.FileInfo().IsDir() {
			os.MkdirAll(path, file.Mode())
			continue
		}

		fileReader, err := file.Open()
		if err != nil {

			if fileReader != nil {
				fileReader.Close()
			}

			return err
		}

		targetFile, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, file.Mode())
		if err != nil {
			fileReader.Close()

			if targetFile != nil {
				targetFile.Close()
			}

			return err
		}

		if _, err := io.Copy(targetFile, fileReader); err != nil {
			fileReader.Close()
			targetFile.Close()

			return err
		}

		fileReader.Close()
		targetFile.Close()
	}

	return nil
}

func Zip(source, target string) error {
	zipfile, err := os.Create(target)
	if err != nil {
		return err
	}
	defer zipfile.Close()

	archive := zip.NewWriter(zipfile)
	defer archive.Close()

	info, err := os.Stat(source)
	if err != nil {
		return nil
	}

	var baseDir string
	if info.IsDir() {
		baseDir = filepath.Base(source)
	}

	filepath.Walk(source, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}

		if baseDir != "" {
			header.Name = filepath.Join(baseDir, strings.TrimPrefix(path, source))
		}

		if info.IsDir() {
			header.Name += "/"
		} else {
			header.Method = zip.Deflate
		}

		writer, err := archive.CreateHeader(header)
		if err != nil {
			return err
		}

		if info.IsDir() {
			return nil
		}

		file, err := os.Open(path)
		if err != nil {
			return err
		}
		defer file.Close()
		_, err = io.Copy(writer, file)
		return err
	})

	return err
}

func saveJob(dir string, job *model.Compliance) *model.AppError {
	props := map[string]interface{}{"JobName": job.Type + "-" + job.Desc, "FilePath": dir + "/meta.json"}

	b, err := json.MarshalIndent(job, "", "    ")
	if err != nil {
		return model.NewLocAppError("/compliance", "ent.compliance.run_failed.error", props, err.Error())
	}

	err = ioutil.WriteFile(dir+"/meta.json", b, 0644)
	if err != nil {
		return model.NewLocAppError("/compliance", "ent.compliance.run_failed.error", props, err.Error())
	}

	return nil
}

func (me *ComplianceInterfaceImpl) RunComplianceJob(job *model.Compliance) *model.AppError {
	crsFileMutex.Lock()
	defer crsFileMutex.Unlock()

	if !*utils.Cfg.ComplianceSettings.Enable || !utils.IsLicensed || !*utils.License.Features.Compliance {
		return model.NewLocAppError("connect", "ent.compliance.licence_disable.app_error", nil, "")
	}

	jobDir := *utils.Cfg.ComplianceSettings.Directory + "compliance/" + job.JobName()
	postFilePath := jobDir + "/posts.csv"

	props := map[string]interface{}{"JobName": job.Type + "-" + job.Desc, "FilePath": jobDir}
	l4g.Info(utils.T("ent.compliance.run_started.info", props))

	job.Status = model.COMPLIANCE_STATUS_RUNNING
	<-api.Srv.Store.Compliance().Update(job)

	err := os.MkdirAll(jobDir, 0774)
	if err != nil {
		job.Status = model.COMPLIANCE_STATUS_FAILED
		<-api.Srv.Store.Compliance().Update(job)
		return model.NewLocAppError("/compliance", "ent.compliance.run_failed.error", props, err.Error())
	}

	job.Status = ""
	saveError := saveJob(jobDir, job)
	if saveError != nil {
		job.Status = model.COMPLIANCE_STATUS_FAILED
		<-api.Srv.Store.Compliance().Update(job)
		return saveError
	}

	file, err := os.Create(postFilePath)
	if err != nil {
		job.Status = model.COMPLIANCE_STATUS_FAILED
		<-api.Srv.Store.Compliance().Update(job)
		return model.NewLocAppError("/compliance", "ent.compliance.run_failed.error", props, err.Error())
	}

	if cr := <-api.Srv.Store.Compliance().ComplianceExport(job); cr.Err != nil {
		job.Status = model.COMPLIANCE_STATUS_FAILED
		<-api.Srv.Store.Compliance().Update(job)
		return model.NewLocAppError("/compliance", "ent.compliance.run_failed.error", props, cr.Err.Error())
	} else {
		cposts := cr.Data.([]*model.CompliancePost)
		props["Count"] = len(cposts)

		if len(cposts) > 29999 {
			l4g.Warn(utils.T("ent.compliance.run_limit.warning", props))
		}

		w := csv.NewWriter(file)

		if err := w.Write(model.CompliancePostHeader()); err != nil {
			job.Status = model.COMPLIANCE_STATUS_FAILED
			<-api.Srv.Store.Compliance().Update(job)
			return model.NewLocAppError("/compliance", "ent.compliance.run_failed.error", props, err.Error())
		}

		for _, record := range cposts {
			if err := w.Write(record.Row()); err != nil {
				job.Status = model.COMPLIANCE_STATUS_FAILED
				<-api.Srv.Store.Compliance().Update(job)
				return model.NewLocAppError("/compliance", "ent.compliance.run_failed.error", props, err.Error())
			}
		}

		err = w.Error()
		if err != nil {
			job.Status = model.COMPLIANCE_STATUS_FAILED
			<-api.Srv.Store.Compliance().Update(job)
			return model.NewLocAppError("/compliance", "ent.compliance.run_failed.error", props, err.Error())
		}

		w.Flush()

		absJobDir, _ := filepath.Abs(jobDir)
		err := Zip(absJobDir, jobDir+".zip")
		if err != nil {
			job.Status = model.COMPLIANCE_STATUS_FAILED
			<-api.Srv.Store.Compliance().Update(job)
			return model.NewLocAppError("/compliance", "ent.compliance.run_failed.error", props, err.Error())
		}

		err = os.RemoveAll(jobDir)
		if err != nil {
			job.Status = model.COMPLIANCE_STATUS_FAILED
			<-api.Srv.Store.Compliance().Update(job)
			return model.NewLocAppError("/compliance", "ent.compliance.run_failed.error", props, err.Error())
		}

		l4g.Info(utils.T("ent.compliance.run_finished.info", props))

		job.Status = model.COMPLIANCE_STATUS_FINISHED
		job.Count = len(cposts)
		<-api.Srv.Store.Compliance().Update(job)
	}

	return nil
}

func (me *ComplianceInterfaceImpl) StartComplianceDailyJob() {
	go func() {
		for {
			if *utils.Cfg.ComplianceSettings.Enable &&
				*utils.Cfg.ComplianceSettings.EnableDaily &&
				utils.IsLicensed &&
				*utils.License.Features.Compliance {

				if result := <-api.Srv.Store.System().Get(); result.Err == nil {
					exportUpToTime := utils.StartOfDay(utils.Yesterday())
					props := result.Data.(model.StringMap)

					t, err := time.Parse("2006-01-02", props[model.SYSTEM_LAST_COMPLIANCE_TIME])
					if err != nil {
						t = exportUpToTime.AddDate(0, 0, -1)
					}

					t = t.AddDate(0, 0, 1)

					for utils.MillisFromTime(exportUpToTime)-utils.MillisFromTime(t) >= 0 {
						timePart := t.Format("2006-01-02")

						c := &model.Compliance{
							Desc:    timePart,
							Type:    model.COMPLIANCE_TYPE_DAILY,
							StartAt: utils.MillisFromTime(t),
							EndAt:   utils.MillisFromTime(utils.EndOfDay(t)),
						}

						if result := <-api.Srv.Store.Compliance().Save(c); result.Err != nil {
							l4g.Error(utils.T("api.context.log.error"), "/compliance/daily", result.Err.Where, result.Err.StatusCode,
								"", "", "", result.Err.Message, result.Err.DetailedError)
						} else {
							c = result.Data.(*model.Compliance)
						}

						err := me.RunComplianceJob(c)
						if err != nil {
							l4g.Error(utils.T("api.context.log.error"), "/compliance/daily", err.Where, err.StatusCode,
								"", "", "", err.Message, err.DetailedError)
						}

						lastTime := &model.System{Name: model.SYSTEM_LAST_COMPLIANCE_TIME, Value: timePart}
						if props[model.SYSTEM_LAST_COMPLIANCE_TIME] == "" {
							props[model.SYSTEM_LAST_COMPLIANCE_TIME] = timePart
							<-api.Srv.Store.System().Save(lastTime)
						} else {
							<-api.Srv.Store.System().Update(lastTime)
						}

						t = t.AddDate(0, 0, 1)
					}
				}
			}

			time.Sleep(time.Hour * 1)
		}
	}()
}
