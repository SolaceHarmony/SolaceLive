module.exports = {
  root: true,
  extends: ['next/core-web-vitals', 'plugin:react/recommended'],
  plugins: ['react', 'react-hooks', '@next/next'],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    // customize rules as needed
  },
};
