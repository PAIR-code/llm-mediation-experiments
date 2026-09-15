#!/usr/bin/env node
import process from 'node:process';
import {runBot} from '../../core/runner.js';
import {HelloWorldBot} from './bot.js';

runBot(new HelloWorldBot()).catch((err) => {
  console.error('\n❌ Fatal error in Hello World Diagnostic Bot:');
  console.error(err);
  process.exit(1);
});
