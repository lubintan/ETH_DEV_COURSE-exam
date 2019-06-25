/* global web3 assert artifacts contract describe before beforeEach it */

const fs = require("fs");
const path = require('path');
const expectedExceptionPromise = require("../../utils/expectedException.js");
const metaInfoSaver = require("../../utils/metaInfoSaver.js")(fs);

const allArtifacts = {
    MultiplierHolder: artifacts.require("./MultiplierHolder.sol"),
    TollBoothOperator: artifacts.require("./TollBoothOperator.sol")
};

const maxGas = 15000000;

const constructors = {
    MultiplierHolder: (owner, paused, value) => allArtifacts.MultiplierHolder.new(
        { from: owner, value: value || 0 }),
    TollBoothOperator: (owner, paused, value) => allArtifacts.TollBoothOperator.new(
        paused, 1, owner, { from: owner, value: value || 0 })
};

contract("MultiplierHolder", function(accounts) {

    let owner0, owner1;
    const type0 = Math.floor(Math.random() * 1000) + 1;
    const type1 = type0 + Math.floor(Math.random() * 1000) + 1;
    const multiplier0 = Math.floor(Math.random() * 1000) + 1;
    const multiplier1 = multiplier0 + Math.floor(Math.random() * 1000) + 1;

    before("should prepare", async function() {
        assert.isAtLeast(accounts.length, 2);
        [ owner0, owner1 ] = accounts;
        const balance = await web3.eth.getBalance(owner0);
        assert.isAtLeast(parseInt(web3.utils.fromWei(balance)), 10);
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
            await expectedExceptionPromise(
                () => constructors[name](owner0, false, 1));
        }).setB9Points(1).setB9MustPass("failsCode");

        describe(name, function() {

            let holder;

            beforeEach("should deploy a new un-paused " + name, async function() {
                holder = await constructors[name](owner0, false);
            });

            describe("getMultiplier", function() {

                it("should have correct initial value", async function() {
                    assert.strictEqual((await holder.getMultiplier(type0)).toNumber(), 0);
                    assert.strictEqual((await holder.getMultiplier(type1)).toNumber(), 0);
                }).setB9Points(1).setB9MustPass("failsCode");

                it("should be possible to ask for multiplier from any address", async function() {
                    const multiplier = await holder.getMultiplier(type0, { from: owner1 });
                    assert.strictEqual(multiplier.toNumber(), 0);
                }).setB9Points(1).setB9MustPass("failsCode");

                it("should be possible to send successfully a transaction to getMultiplier", async function() {
                    const txObj = await holder.getMultiplier.sendTransaction(type0, { from: owner1 });
                    assert.isTrue(txObj.receipt.status);
                }).setB9Points(1).setB9MustPass("failsCode");

                it("should be possible to send a transaction to getMultiplier without any event", async function() {
                    const txObj = await holder.getMultiplier.sendTransaction(type0, { from: owner1 });
                    assert.strictEqual(txObj.receipt.logs.length, 0);
                }).setB9Points(1).setB9MustPass("failsCode");

                it("should be possible to send a transaction to getMultiplier without changing multiplier", async function() {
                    const txObj = await holder.getMultiplier.sendTransaction(type0, { from: owner1 });
                    assert.strictEqual((await holder.getMultiplier(type0)).toNumber(), 0);
                }).setB9Points(1).setB9MustPass("failsCode");

                it("should not be possible to send a transaction with value to getMultiplier", async function() {
                    await expectedExceptionPromise(
                        () => holder.getMultiplier.sendTransaction(type0, { from: owner1, value: 1, gas: maxGas }),
                        maxGas);
                }).setB9Points(1).setB9MustPass("failsCode");

            });

            describe("setMultiplier", function() {

                it("should not be possible to set multiplier if asking from wrong owner", async function() {
                    await expectedExceptionPromise(
                        () => holder.setMultiplier(type0, multiplier0, { from: owner1, gas: maxGas }),
                        maxGas);
                }).setB9Points(5).setB9MustPass("failsCode");

                it("should not be possible to set multiplier if type is 0", async function() {
                    await expectedExceptionPromise(
                        () => holder.setMultiplier(0, multiplier0, { from: owner0, gas: maxGas }),
                        maxGas);
                }).setB9Points(2).setB9MustPass("failsCode");

                it("should not be possible to set multiplier if no change", async function() {
                    await holder.setMultiplier(type0, multiplier0, { from: owner0 });
                    await expectedExceptionPromise(
                        () => holder.setMultiplier(type0, multiplier0, { from: owner0, gas: maxGas }),
                        maxGas);
                }).setB9Points(2).setB9MustPass("failsCode");

                it("should not be possible to set multiplier if pass value", async function() {
                    await expectedExceptionPromise(
                        () => holder.setMultiplier(type0, multiplier0, { from: owner0, value: 1, gas: maxGas }),
                        maxGas);
                }).setB9Points(3).setB9MustPass("failsCode");

                it("should be possible to set 1 multiplier and return true", async function() {
                    const success = await holder.setMultiplier.call(type0, multiplier0, { from: owner0 });
                    assert.isTrue(success);
                }).setB9Points(1).setB9MustPass("failsCode");

                it("should be possible to set 1 multiplier and emit event", async function() {
                    const txObj = await holder.setMultiplier(type0, multiplier0, { from: owner0 });
                    assert.strictEqual(txObj.receipt.logs.length, 1);
                    assert.strictEqual(txObj.logs.length, 1);
                    const logChanged = txObj.logs[0];
                    assert.strictEqual(logChanged.event, "LogMultiplierSet");
                    assert.strictEqual(logChanged.args.sender, owner0);
                    assert.strictEqual(logChanged.args.vehicleType.toNumber(), type0);
                    assert.strictEqual(logChanged.args.multiplier.toNumber(), multiplier0);
                }).setB9Points(1).setB9MustPass("failsCode");

                it("should be possible to set 1 multiplier and update multiplier", async function() {
                    await holder.setMultiplier(type0, multiplier0, { from: owner0 });
                    assert.strictEqual((await holder.getMultiplier(type0)).toNumber(), multiplier0);
                    assert.strictEqual((await holder.getMultiplier(type1)).toNumber(), 0);
                }).setB9Points(1).setB9MustPass("failsCode");

            });

            if (name === "TollBoothOperator") {

                describe("setMultiplier in TollBoothOperator is not pausable", function() {

                    beforeEach("should pause holder", async function() {
                        await holder.setMultiplier(type0, multiplier0, { from: owner0 });
                        await holder.setPaused(true, { from: owner0 });
                    });

                    it("should be possible to check getMultiplier if paused", async function() {
                        assert.strictEqual((await holder.getMultiplier(type0)).toNumber(), multiplier0);
                    }).setB9Points(1).setB9MustPass("failsCode");

                    it("should be possible to set multiplier if paused", async function() {
                        await holder.setMultiplier(type0, multiplier1, { from: owner0 });
                        assert.strictEqual((await holder.getMultiplier(type0)).toNumber(), multiplier1);
                        assert.strictEqual((await holder.getMultiplier(type1)).toNumber(), 0);
                    }).setB9Points(1).setB9MustPass("failsCode");

                });

            }

            describe("setMultiplier a second time", function() {

                const parameters = [
                    // Not this one because it is same as beforeEach "t0 - m0"
                    { name: "type0 - zero", type: type0, multiplier: 0 },
                    { name: "type0 - multiplier1", type: type0, multiplier: multiplier1 },
                    { name: "type1 - multiplier0", type: type1, multiplier: multiplier0 },
                    { name: "type1 - multiplier1", type: type1, multiplier: multiplier1 }
                ];

                beforeEach("should set first multiplier", async function() {
                    await holder.setMultiplier(type0, multiplier0, { from: owner0 });
                });

                parameters.forEach(arg => {

                    it("should be possible to set another multiplier with values " + arg.name + " and return true", async function() {
                        assert.isTrue(await holder.setMultiplier.call(arg.type, arg.multiplier, { from: owner0 }));
                    }).setB9Points(1).setB9MustPass("failsCode");

                    it("should be possible to set another multiplier with values " + arg.name + " and emit event", async function() {
                        const txObj = await holder.setMultiplier(arg.type, arg.multiplier, { from: owner0 });
                        assert.strictEqual(txObj.receipt.logs.length, 1);
                        assert.strictEqual(txObj.logs.length, 1);
                        const logChanged = txObj.logs[0];
                        assert.strictEqual(logChanged.event, "LogMultiplierSet");
                        assert.strictEqual(logChanged.args.sender, owner0);
                        assert.strictEqual(logChanged.args.vehicleType.toNumber(), arg.type);
                        assert.strictEqual(logChanged.args.multiplier.toNumber(), arg.multiplier);
                    }).setB9Points(1).setB9MustPass("failsCode");

                    it("should be possible to set another multiplier with values " + arg.name + " and update multiplier", async function() {
                        await holder.setMultiplier(arg.type, arg.multiplier, { from: owner0 });
                        assert.strictEqual(
                            (await holder.getMultiplier(type0)).toNumber(),
                            arg.type === type0 ? arg.multiplier : multiplier0);
                        assert.strictEqual(
                            (await holder.getMultiplier(type1)).toNumber(),
                            arg.type === type1 ? arg.multiplier : 0);
                    }).setB9Points(1).setB9MustPass("failsCode");

                });

            });

            describe("setMultiplier a second time after an owner change", function() {

                beforeEach("should set multiplier then change owners", async function() {
                    await holder.setMultiplier(type0, multiplier0, { from: owner0 });
                    await holder.setOwner(owner1, { from: owner0 });
                });

                it("should not be possible to set another multiplier if old owner", async function() {
                    await expectedExceptionPromise(
                        () => holder.setMultiplier(type1, multiplier1, { from: owner0, gas: maxGas }),
                        maxGas);
                }).setB9Points(3).setB9MustPass("failsCode");

                it("should not be possible to set multiplier if same", async function() {
                    await expectedExceptionPromise(
                        () => holder.setMultiplier(type0, multiplier0, { from: owner1, gas: maxGas }),
                        maxGas);
                }).setB9Points(1).setB9MustPass("failsCode");

                it("should be possible to set another multiplier and return true", async function() {
                    assert.isTrue(await holder.setMultiplier.call(type1, multiplier1, { from: owner1 }));
                }).setB9Points(1).setB9MustPass("failsCode");

                it("should be possible to set another multiplier and emit event", async function() {
                    const txObj = await holder.setMultiplier(type1, multiplier1, { from: owner1 });
                    assert.strictEqual(txObj.receipt.logs.length, 1);
                    assert.strictEqual(txObj.logs.length, 1);
                    const logChanged = txObj.logs[0];
                    assert.strictEqual(logChanged.event, "LogMultiplierSet");
                    assert.strictEqual(logChanged.args.sender, owner1);
                    assert.strictEqual(logChanged.args.vehicleType.toNumber(), type1);
                    assert.strictEqual(logChanged.args.multiplier.toNumber(), multiplier1);
                }).setB9Points(1).setB9MustPass("failsCode");

                it("should be possible to set another multiplier and update it", async function() {
                    await holder.setMultiplier(type1, multiplier1, { from: owner1 });
                    assert.strictEqual((await holder.getMultiplier(type0)).toNumber(), multiplier0);
                    assert.strictEqual((await holder.getMultiplier(type1)).toNumber(), multiplier1);
                }).setB9Points(1).setB9MustPass("failsCode");

            });

        });

    });

    it("should have correct number of functions", async function() {
        const holder = await constructors.MultiplierHolder(owner0, false);
        assert.strictEqual(Object.keys(holder).length, 16);
        // Expected: ["constructor","methods","abi","contract","setOwner","setMultiplier","getOwner",
        // "getMultiplier","LogMultiplierSet","LogOwnerSet","sendTransaction","send","allEvents","getPastEvents",
        // "address","transactionHash"]
    }).setB9Points(1).setB9MustPass("failsCode");

});
