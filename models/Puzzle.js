const { Model } = require('objection');

class Puzzle extends Model {
    static get tableName() {
        return 'puzzles';
    }
}

module.exports = { Puzzle };