// This module must be imported first, so that the handler is installed as
// early, as possible.

process.on('uncaughtException', (error) => {
  console.error('Uncaught', error);
});

export {};
