jest.mock('../src/utils/database', () => {
  const { Sequelize } = require('sequelize');

  return {
    sequelize: new Sequelize('web_learn', 'root', '', {
      dialect: 'mysql',
      logging: false,
    }),
  };
});

describe('AgentConversation model', () => {
  it('does not declare a database default for long text compressed_summary', async () => {
    const { default: AgentConversation } = await import('../src/models/AgentConversation');

    const compressedSummary = AgentConversation.getAttributes().compressed_summary;

    expect(compressedSummary.defaultValue).toBeUndefined();
  });
});
