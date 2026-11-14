```sh
find /path/to/whatever -type f | sed "1,$MAX_FILES d' | while read fn; do
echo "deleting $fn"
rm -f $fn
done
```