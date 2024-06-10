      - name: ci/e2e-test-gencycle
        id: e2e-test-gencycle
        env:
          AUTOMATION_DASHBOARD_URL: "${{ secrets.AUTOMATION_DASHBOARD_URL }}"
          AUTOMATION_DASHBOARD_TOKEN: "${{ secrets.AUTOMATION_DASHBOARD_TOKEN }}"
          BRANCH: "${{ inputs.BRANCH }}"
          BUILD_ID: "${{ inputs.BUILD_ID }}"
          TEST_FILTER: "${{ inputs.TEST_FILTER }}"
        run: |
          set -e -o pipefail
          make generate-test-cycle | tee generate-test-cycle.out
          # Extract cycle's dashboard URL, if present
          TEST_CYCLE_ID=$(sed -nE "s/^.*id: '([^']+)'.*$/\1/p"  <generate-test-cycle.out)
          if [ -n "$TEST_CYCLE_ID" ]; then
            echo "status_check_url=https://automation-dashboard.vercel.app/cycles/${TEST_CYCLE_ID}" >> $GITHUB_OUTPUT
          else
            echo "status_check_url=${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}" >> $GITHUB_OUTPUT
          fi
