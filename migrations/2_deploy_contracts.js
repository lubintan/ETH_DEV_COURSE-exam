const Regulator = artifacts.require("Regulator");
const TollBoothOperator = artifacts.require("TollBoothOperator");

// async/await seems to have issues in truffle migrations. Using .then instead.

module.exports = function(deployer,network, accounts) {
  [regulatorOwner, tollBoothOpOwner] = accounts;
  const initialDeposit = 10; 
  let depl;

  deployer.deploy(Regulator)
  .then(() => Regulator.deployed())
  .then((deployed) => {
    depl = deployed;
    return deployed.createNewOperator( tollBoothOpOwner, initialDeposit,
      { from: regulatorOwner, gas: 15000000 });
  })
  .then((txObj) => {
    const newOperatorContractAddr = txObj.receipt.logs[1].args.newOperator;
    return TollBoothOperator.at(newOperatorContractAddr);
  })
  .then((tbOperatorContract) => {
    return tbOperatorContract.setPaused(0, { from: tollBoothOpOwner, gas: 300000 });
  })
};

