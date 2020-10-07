
exports.up = function (knex) {
    return knex.schema.createTable('workspaces', table => {
        table.increments('id').primary();
        table.string('team_id');
        table.string('team_name');
        table.string('install_user_id');
        table.string('bot_id');
        table.string('bot_user_id');
        table.string('bot_access_token');
        table.string('scopes');
        table.string('installation');
        table.index(['team_id']);
    });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('workspaces');
};
