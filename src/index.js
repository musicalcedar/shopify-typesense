#!/usr/bin/env node
import 'dotenv/config';
import { program } from 'commander';
import chalk from 'chalk';

import { startCommand } from './commands/start.js';
import { stopCommand } from './commands/stop.js';
import { statusCommand } from './commands/status.js';
import { syncCommand } from './commands/sync.js';
import { checkCommand } from './commands/check.js';
import { dashboardCommand } from './commands/dashboard.js';
import { testSearchCommand } from './commands/test-search.js';

program
  .name('shopify-typesense')
  .description('Sincroniza productos de Shopify con Typesense')
  .version('1.0.0');

program
  .command('check')
  .description('Verifica conexión a Shopify, Typesense y variables de entorno')
  .action(checkCommand);

program
  .command('dashboard')
  .description('Levanta la UI web de Typesense Dashboard en http://localhost:8109')
  .action(dashboardCommand);

program
  .command('start')
  .description('Levanta Typesense en Docker (desarrollo local)')
  .action(startCommand);

program
  .command('stop')
  .description('Para el container de Typesense')
  .action(stopCommand);

program
  .command('status')
  .description('Estado del cluster y estadísticas del índice')
  .action(statusCommand);

program
  .command('test-search <query>')
  .description('Prueba una búsqueda directamente contra Typesense')
  .action(testSearchCommand);

program
  .command('sync')
  .description('Sincroniza productos de Shopify a Typesense')
  .option('--watch', 'Modo incremental: solo productos modificados en las últimas 2 horas')
  .option('--drop', 'Elimina y recrea la colección antes de sincronizar')
  .action(syncCommand);

program.parse();
