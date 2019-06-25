/* global web3 assert artifacts contract describe before beforeEach it */

const fs = require("fs");
const path = require('path');
const expectedExceptionPromise = require("../../utils/expectedException.js");
const metaInfoSaver = require("../../utils/metaInfoSaver.js")(fs);

const allArtifacts = {
    Owned: artifacts.require("./Owned.sol"),
    Pausable: artifacts.require("./Pausable.sol"),
    Regulator: artifacts.require("./Regulator.sol"),
    DepositHolder: artifacts.require("./DepositHolder.sol"),
    MultiplierHolder: artifacts.require("./MultiplierHolder.sol"),
    RoutePriceHolder: artifacts.require("./RoutePriceHolderMock.sol"),
    TollBoothHolder: artifacts.require("./TollBoothHolder.sol"),
    TollBoothOperator: artifacts.require("./TollBoothOperator.sol")
};
const { fromWei, padLeft } = web3.utils;

const maxGas = 15000000;

const constructors = {
    Owned: (owner, value) => allArtifacts.Owned.new(
        { from: owner, value: value || 0 }),
    Pausable: (owner, value) => allArtifacts.Pausable.new(
        false, { from: owner, value: value || 0 }),
    Regulator: (owner, value) => allArtifacts.Regulator.new(
        { from: owner, value: value || 0 }),
    DepositHolder: (owner, value) => allArtifacts.DepositHolder.new(
        105, { from: owner, value: value || 0 }),
    MultiplierHolder: (owner, value) => allArtifacts.MultiplierHolder.new(
        { from: owner, value: value || 0 }),
    RoutePriceHolder: (owner, value) => allArtifacts.RoutePriceHolder.new(
        { from: owner, value: value || 0 }),
    TollBoothHolder: (owner, value) => allArtifacts.TollBoothHolder.new(
        { from: owner, value: value || 0 }),
    TollBoothOperator: (owner, value) => allArtifacts.TollBoothOperator.new(
        false, 105, owner, { from: owner, value: value || 0 })
};

contract("Owned inheritance tree", function(accounts) {

    let owner0, owner1;
    const addressZero = padLeft(0, 40);

    before("should prepare", async function() {
        assert.isAtLeast(accounts.length, 2);
        [ owner0, owner1 ] = accounts;
        const balance = await web3.eth.getBalance(owner0);
        assert.isAtLeast(parseInt(fromWei(balance)), 10);
    });

    after("should save meta info", function() {
        const dirNameElements = __dirname.split(path.sep);
        const dirName = dirNameElements[dirNameElements.length - 1];
        metaInfoSaver(
            this.test.parent,
            __dirname + "/../../result/" + dirName,
            path.basename(__filename) + ".points.json");
    });

    Object.keys(constructors).forEach(name => {

        it("should fail to deploy a " + name + " if pass value", async function() {
            await expectedExceptionPromise(() => constructors[name](owner0, 1));
        }).setB9Points(1).setB9MustPass("failsCode");

        describe(name, function() {

            let owned;

            beforeEach("should deploy a new " + name, async function() {
                owned = await constructors[name](owner0);
            });

            describe("getOwner", function() {

                it("should have correct initial value", async function() {
                    assert.strictEqual(await owned.getOwner(), owner0);
                }).setB9Points(1).setB9MustPass("failsCode");

                it("should be possible to ask for owner from any address", async function() {
                    assert.strictEqual(await owned.getOwner({ from: owner1 }), owner0);
                }).setB9Points(1).setB9MustPass("failsCode");

                it("should be possible to successfully send a transaction to getOwner", async function() {
                    const txObj = await owned.getOwner.sendTransaction({ from: owner1 });
                    assert.isTrue(txObj.receipt.status);
                }).setB9Points(1).setB9MustPass("failsCode");

                it("should be possible to send a transaction to getOwner without an event", async function() {
                    const txObj = await owned.getOwner.sendTransaction({ from: owner1 });
                    assert.strictEqual(txObj.receipt.logs.length, 0);                    
                }).setB9Points(1).setB9MustPass("failsCode");

                it("should be possible to send a transaction to GetOwner without changing owner", async function() {
                    const txObj = await owned.getOwner.sendTransaction({ from: owner1 });
                    assert.strictEqual(await owned.getOwner(), owner0);
                }).setB9Points(1).setB9MustPass("failsCode");

                it("should not be possible to send a transaction with value to getOwner", async function() {
                    await expectedExceptionPromise(
                        () => owned.getOwner.sendTransaction({ from: owner1, value: 1, gas: maxGas }),
                        maxGas);
                }).setB9Points(3).setB9MustPass("failsCode");

            });

            describe("setOwner", function() {

                it("should not be possible to set owner if asking from wrong owner", async function() {
                    await expectedExceptionPromise(
                        () => owned.setOwner(owner1, { from: owner1, gas: maxGas }),
                        maxGas);
                }).setB9Points(5).setB9MustPass("failsCode");

                it("should not be possible to set owner if to 0", async function() {
                    await expectedExceptionPromise(
                        () => owned.setOwner(addressZero, { from: owner0, gas: maxGas }),
                        maxGas);
                }).setB9Points(2).setB9MustPass("failsCode");

                it("should not be possible to set owner if no change", async function() {
                    await expectedExceptionPromise(
                        () => owned.setOwner(owner0, { from: owner0, gas: maxGas }),
                        maxGas);
                }).setB9Points(2).setB9MustPass("failsCode");

                it("should not be possible to set owner if pass value", async function() {
                    await expectedExceptionPromise(
                        () => owned.setOwner(owner1, { from: owner0, value: 1, gas: maxGas }),
                        maxGas);
                }).setB9Points(3).setB9MustPass("failsCode");

                it("should be possible to set owner and return true", async function() {
                    assert.isTrue(await owned.setOwner.call(owner1, { from: owner0 }));
                }).setB9Points(1).setB9MustPass("failsCode");

                it("should be possible to set owner and emit event", async function() {
                    const txObj = await owned.setOwner(owner1, { from: owner0 });
                    assert.strictEqual(txObj.receipt.logs.length, 1);
                    assert.strictEqual(txObj.logs.length, 1);
                    const logChanged = txObj.logs[0];
                    assert.strictEqual(logChanged.event, "LogOwnerSet");
                    assert.strictEqual(logChanged.args.previousOwner, owner0);
                    assert.strictEqual(logChanged.args.newOwner, owner1);
                }).setB9Points(1).setB9MustPass("failsCode");

                it("should be possible to set owner and update owner", async function() {
                    await owned.setOwner(owner1, { from: owner0 });
                    assert.strictEqual(await owned.getOwner(), owner1);
                }).setB9Points(1).setB9MustPass("failsCode");

            });

            describe("setOwner a second time", function() {

                beforeEach("should set owner once", async function() {
                    await owned.setOwner(owner1, { from: owner0 });
                });

                it("should not be possible to set owner if asking from wrong one", async function() {
                    await expectedExceptionPromise(
                        () => owned.setOwner(owner0, { from: owner0, gas: maxGas }),
                        maxGas);
                }).setB9Points(1).setB9MustPass("failsCode");

                it("should not be possible to set owner if no change", async function() {
                    await expectedExceptionPromise(
                        () => owned.setOwner(owner1, { from: owner1, gas: maxGas }),
                        maxGas);
                }).setB9Points(1).setB9MustPass("failsCode");

                it("should be possible to set owner again and return true", async function() {
                    assert.isTrue(await owned.setOwner.call(owner0, { from: owner1 }));
                }).setB9Points(1).setB9MustPass("failsCode");

                it("should be possible to set owner again and emit event", async function() {
                    const txObj = await owned.setOwner(owner0, { from: owner1 });
                    assert.strictEqual(txObj.receipt.logs.length, 1);
                    assert.strictEqual(txObj.logs.length, 1);
                    const logChanged = txObj.logs[0];
                    assert.strictEqual(logChanged.event, "LogOwnerSet");
                    assert.strictEqual(logChanged.args.previousOwner, owner1);
                    assert.strictEqual(logChanged.args.newOwner, owner0);
                }).setB9Points(1).setB9MustPass("failsCode");

                it("should be possible to set owner again and update owner", async function() {
                    await owned.setOwner(owner0, { from: owner1 });
                    assert.strictEqual(await owned.getOwner(), owner0);
                }).setB9Points(1).setB9MustPass("failsCode");

            });

        });

    });

    it("should have correct number of functions", async function() {
        const owned = await constructors.Owned(owner0);
        assert.strictEqual(Object.keys(owned).length, 13);
        // Expected: ["constructor","methods","abi","contract","getOwner","setOwner","LogOwnerSet",
        // "sendTransaction","send","allEvents","getPastEvents","address","transactionHash"]
    }).setB9Points(1).setB9MustPass("failsCode");

});
