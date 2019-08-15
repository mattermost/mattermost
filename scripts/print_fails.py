import sys

targets = [
  '--- FAIL'
]

stoppers = [
  'coverage',
  '=== RUN',
  '--- PASS',
]

fails = []
current_fail = None
for line in sys.stdin:
  if line.strip() in targets:
    current_fail = []
    fails.append(current_fail)
  elif line.strip() in stoppers:
    current_fail = None

  if current_fail is not None:
    current_fail.append(line)

  print(line)


for f in fails:
  for line in f:
    print(line)
