const { Model } = require('objection');

class Workspace extends Model {
    static get tableName() {
        return 'workspaces';
    }
}

module.exports = { Workspace };