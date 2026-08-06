The importer has been dropping about 2% of rows since we added the streaming parser in
#4471, and nobody noticed because the row count in the summary log is taken from the parser
rather than from what actually got written.

The parser emits a final chunk on end. The writer's flush path assumed the last chunk had
already been handled by the loop and skipped it. So every import lost exactly one chunk,
which is why the loss rate looked like a percentage rather than a constant: bigger files
have more chunks, so the last one is a smaller share.

The fix is to have the writer own the flush and the parser just say when it is done. I also
considered making the parser flush synchronously before emitting end, which is a smaller
diff, but it puts writer logic in the parser and I would rather not.

The summary log now counts written rows rather than parsed rows, which is what it should
have done from the start.

Tested with the 400MB fixture in `fixtures/large.csv`: before the change, 1,048,404 of
1,069,798 rows written. After, all 1,069,798. `npm test` passes, and I added a case that
fails against the old writer.

Not tested on Windows. The path handling is untouched so I do not expect a problem, but I
have no box to check on.
