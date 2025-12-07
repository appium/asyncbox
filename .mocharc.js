module.exports = {
  require: ['tsx/cjs'],
  forbidOnly: Boolean(process.env.CI)
};
