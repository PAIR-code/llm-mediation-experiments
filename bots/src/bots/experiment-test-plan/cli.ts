#!/usr/bin/env node
import process from 'node:process';
import {runBot} from '../../core/runner.js';
import {ExperimentTestPlanBot} from './bot.js';

runBot(new ExperimentTestPlanBot()).catch((err) => {
  console.error('\n❌ Fatal error in Experiment Test Plan Assistant:');
  console.error(err);
  process.exit(1);
});
