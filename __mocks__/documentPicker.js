module.exports = {
  pick: jest.fn(async () => [
    {
      uri: 'file:///printforge-test.pdf',
      name: 'printforge-test.pdf',
      type: 'application/pdf',
      size: 2048,
    },
  ]),
  types: {
    images: 'image/*',
    pdf: 'application/pdf',
  },
};
