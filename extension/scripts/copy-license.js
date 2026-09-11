#!/usr/bin/env node
// package.json says "SEE LICENSE IN ../LICENSE", which is true in the repository
// but not inside a .vsix. Copy the root licence in right before packaging.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const source = path.join(__dirname, '..', '..', 'LICENSE');
const target = path.join(__dirname, '..', 'LICENSE');
fs.copyFileSync(source, target);
console.log(`copied ${path.relative(process.cwd(), source)} -> ${path.relative(process.cwd(), target)}`);
