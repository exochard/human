# pipetool

Reads a CSV on stdin, writes a CSV on stdout, and lets you put a shell command in between.

    cat sales.csv | pipetool --col revenue 'awk "{print \$1 * 1.2}"'

That's the whole idea. I wrote it because I kept piping CSVs through awk and getting the
header row mangled, and every existing tool wanted me to learn a query language first.

It handles quoted fields with embedded commas and newlines. It does not handle CSVs with
inconsistent column counts per row, because I have never seen one that wasn't a bug
upstream. If you have, open an issue with the file and I will reconsider.

Speed: about 40 MB/s on my laptop, which is a 2019 ThinkPad. Roughly the same as `csvkit`
and roughly 8x slower than a hand-rolled awk script. If you need the 8x, write the awk
script.

## Install

    go install github.com/example/pipetool@latest

## Why not csvkit

csvkit is better if you want SQL. This is better if you already know the shell command you
want to run and just want the header preserved.
