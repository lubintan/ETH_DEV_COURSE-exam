module.exports = {
    networks: {
        development: {
            host: "localhost",
            port: 8545,
            network_id: "*", // Match any network id
            gas: 15000000
        }
    },
    mocha: {
        reporter: "json",
        slow: 500
    }
};
