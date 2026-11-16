const PREFIX = 'ps.';

function stateKey(key) {
  return PREFIX + key;
}

function createStateStore(globalState) {
  return {
    get(key, fallback) {
      return globalState.get(stateKey(key), fallback);
    },
    set(key, value) {
      return globalState.update(stateKey(key), value);
    },
  };
}

module.exports = {
  PREFIX,
  stateKey,
  createStateStore,
};
