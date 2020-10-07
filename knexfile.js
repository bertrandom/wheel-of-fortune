module.exports = {
  dev: {
	client: 'sqlite3',
	useNullAsDefault: true,
	connection: {
		filename: './db/wheel.db'
	},
	pool: {
		afterCreate: (conn, cb) => {
			conn.run('PRAGMA journal_mode=WAL; PRAGMA foreign_keys = ON', cb);
		}
	}
  },
  prod: {
	client: 'sqlite3',
	useNullAsDefault: true,
	connection: {
		filename: './db/wheel.db'
	},
	pool: {
		afterCreate: (conn, cb) => {
			conn.run('PRAGMA journal_mode=WAL; PRAGMA foreign_keys = ON', cb);
		}
	}
  }
};