#!/usr/bin/env node

/**
 * cli.js — Entry point for the course-creator CLI.
 *
 * Usage:
 *   course-creator <source> [options]
 *
 * Examples:
 *   course-creator anthropics/claude-code
 *   course-creator npm:zod --no-video --quick
 *   course-creator https://docs.python.org/3/library/asyncio.html --sections 6
 */

import { loadConfig } from './config.js';
import { generateCourse } from './orchestrator.js';

const USAGE = `
Usage: course-creator <source> [options]

Source types:
  owner/repo                GitHub repository slug
  owner/repo/path           GitHub slug with subdirectory
  https://github.com/...    GitHub URL (branch/path auto-detected)
  https://docs.example.com  Documentation URL
  npm:package-name          npm package (resolves to GitHub)
  pypi:package-name         PyPI package (resolves to GitHub)
  ./path/to/dir             Local directory path

Options:
  --sections N      Target N sections (default: auto, 5-12)
  --no-video        Skip HeyGen video generation
  --no-quizzes      Omit quizzes and assessments
  --avatar <id>     HeyGen avatar ID
  --voice <id>      HeyGen voice ID
  --deep            Deep dive: 8-12 sections, advanced content
  --quick           Quick overview: 3-5 sections, lighter content
  --audience <lvl>  beginner | intermediate | advanced (default: auto)
  --help            Show this help message
`.trim();

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {};
  let source = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--help':
      case '-h':
        console.log(USAGE);
        process.exit(0);
        break;
      case '--no-video':
        options.noVideo = true;
        break;
      case '--no-quizzes':
        options.noQuizzes = true;
        break;
      case '--deep':
        options.deep = true;
        break;
      case '--quick':
        options.quick = true;
        break;
      case '--sections':
        i++;
        options.sections = parseInt(args[i], 10);
        if (isNaN(options.sections)) {
          console.error('Error: --sections requires a number');
          process.exit(1);
        }
        break;
      case '--avatar':
        i++;
        options.avatar = args[i];
        if (!options.avatar) {
          console.error('Error: --avatar requires an ID');
          process.exit(1);
        }
        break;
      case '--voice':
        i++;
        options.voice = args[i];
        if (!options.voice) {
          console.error('Error: --voice requires an ID');
          process.exit(1);
        }
        break;
      case '--audience':
        i++;
        options.audience = args[i];
        if (!['beginner', 'intermediate', 'advanced'].includes(options.audience)) {
          console.error('Error: --audience must be beginner, intermediate, or advanced');
          process.exit(1);
        }
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`Unknown option: ${arg}`);
          console.error('Run with --help for usage information.');
          process.exit(1);
        }
        if (source) {
          console.error(`Unexpected argument: ${arg} (source already set to "${source}")`);
          process.exit(1);
        }
        source = arg;
        break;
    }
  }

  return { source, options };
}

const { source, options } = parseArgs(process.argv);

if (!source) {
  console.error('Error: no source provided.\n');
  console.log(USAGE);
  process.exit(1);
}

const configOverrides = {};
if (options.avatar) configOverrides.heygen = { avatar_id: options.avatar };
if (options.voice) {
  configOverrides.heygen = { ...configOverrides.heygen, voice_id: options.voice };
}

const config = loadConfig(configOverrides);

try {
  await generateCourse(source, options, config);
} catch (err) {
  if (err.message?.includes('Ambiguous source')) {
    console.error(err.message);
    process.exit(1);
  }
  console.error(`\nError: ${err.message}`);
  if (process.env.DEBUG) {
    console.error(err.stack);
  }
  process.exit(1);
}
