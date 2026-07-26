import {rmSync} from 'node:fs';

rmSync('build', {recursive: true, force: true});
