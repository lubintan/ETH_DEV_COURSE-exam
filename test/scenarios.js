/* global web3 assert artifacts contract describe before beforeEach it */

// This is where you write your test scenarios as per the README.

const fs = require("fs");
const path = require('path');
const expectedExceptionPromise = require("../utils/expectedException.js");
const randomIntIn = require("../utils/randomIntIn.js");
const toBytes32 = require("../utils/toBytes32.js");
// const metaInfoSaver = require("../utils/metaInfoSaver.js")(fs);

const Regulator = artifacts.require("./Regulator.sol");
const TollBoothOperator = artifacts.require("./TollBoothOperator.sol");
const { fromWei, padLeft, toBN } = web3.utils;

const maxGas = 15000000;

function checkExitLog(log, exitBooth, exitSecretHashed, finalFee, refundWeis) {
    assert.strictEqual(log.event, "LogRoadExited", "Exit log event name incorrect.");
    assert.strictEqual(log.args.exitBooth, exitBooth, "Exit log exit booth incorrect.");
    assert.strictEqual(log.args.exitSecretHashed, exitSecretHashed, "Exit log hash incorrect.");
    assert.strictEqual(log.args.finalFee.toString(10), finalFee, "Exit log final fee incorrect.");
    assert.strictEqual(log.args.refundWeis.toString(10), refundWeis, "Exit log refund incorrect.");
}

function checkPendingLog(log, exitSecretHashed, entryBooth, exitBooth) {
    assert.strictEqual(log.event, "LogPendingPayment", "Pending log name incorrect.");
    assert.strictEqual(log.args.exitSecretHashed, exitSecretHashed, "Pending log hash incorrect.");
    assert.strictEqual(log.args.entryBooth, entryBooth, "Pending log entry booth incorrect.");
    assert.strictEqual(log.args.exitBooth, exitBooth, "Pending log exit booth incorrect.");
}

function checkSetRoutePriceLog(log, sender, entryBooth, exitBooth, priceWeis) {
    assert.strictEqual(log.event, "LogRoutePriceSet", "Set route price log name incorrect.");
    assert.strictEqual(log.args.sender, sender, "Set route price log sender incorrect.");
    assert.strictEqual(log.args.entryBooth, entryBooth, "Set route price entry booth incorrect.");
    assert.strictEqual(log.args.exitBooth, exitBooth, "Set route price log exit booth incorrect.");
    assert.strictEqual(log.args.priceWeis.toString(10), priceWeis, "Set route price log priceWeis incorrect.");
}

function checkEntryLog(log, vehicle, entryBooth, exitSecretHashed, multiplier, depositedWeis) {
    assert.strictEqual(log.event, "LogRoadEntered", "Enter log name incorrect.");
    assert.strictEqual(log.args.vehicle, vehicle, "Enter log vehicle incorrect.");
    assert.strictEqual(log.args.entryBooth, entryBooth, "Enter entry booth incorrect.");
    assert.strictEqual(log.args.exitSecretHashed, exitSecretHashed, "Enter log hash incorrect.");
    assert.strictEqual(log.args.multiplier.toString(10), multiplier, "Enter log multiplier incorrect.");
    assert.strictEqual(log.args.depositedWeis.toString(10), depositedWeis, "Enter log depositedWeis incorrect.");
}

contract("Scenarios", function(accounts) {

    // Add as many `before`, `beforeEach`, `describe`, `afterEach`, `after` as you want.
    // But no additional `it`.

    let owner0, owner1, booth1, booth2, vehicle1, vehicle2, someoneElse;
    // const addressZero = padLeft(0, 40);
    const price01 = randomIntIn(1, 1000);
    const deposit0 = price01 + randomIntIn(1, 1000);
    // const deposit1 = deposit0 + randomIntIn(1, 1000);
    const vehicleType0 = randomIntIn(1, 1000);
    // const vehicleType1 = vehicleType0 + randomIntIn(1, 1000);
    const multiplier0 = randomIntIn(1, 1000);
    // const multiplier1 = multiplier0 + randomIntIn(1, 1000);
    const tmpSecret = randomIntIn(1, 1000);
    const secret1 = toBytes32(tmpSecret);
    const secret2 = toBytes32(tmpSecret + randomIntIn(1, 1000));

    before("Prepare and deploy regulator", async function() {
        assert.isAtLeast(accounts.length, 8);
        [ owner0, owner1, booth1, booth2, vehicle1, vehicle2, someoneElse ] = accounts;
        regulator = await Regulator.new({ from: owner0 });
        await regulator.setVehicleType(vehicle1, vehicleType0, { from: owner0 });
        await regulator.setVehicleType(vehicle2, vehicleType0, { from: owner0 });
    });

    describe("Tests with new operator deployed for each test.", function() {

        beforeEach("Deploy Operator and set up toll booths.", async function() {
            const txObj = await regulator.createNewOperator(owner1, deposit0, { from: owner0 });
            operator = await TollBoothOperator.at(txObj.logs[1].args.newOperator);
            // await operator.addTollBooth(booth0, { from: owner1 });
            await operator.addTollBooth(booth1, { from: owner1 });
            await operator.addTollBooth(booth2, { from: owner1 });
            await operator.setMultiplier(vehicleType0, multiplier0, { from: owner1 });
            // await operator.setMultiplier(vehicleType1, multiplier1, { from: owner1 });
            // await operator.setRoutePrice(booth0, booth1, price01, { from: owner1 });
            await operator.setPaused(false, { from: owner1 });
            hashed1 = await operator.hashSecret(secret1);
            hashed2 = await operator.hashSecret(secret2);
        });

        describe("Tests with vehicle entry deposit equal to minimum required.", function() {
            let paymentDeposit;

            beforeEach("Set up vehicle entry.", async function() {
                paymentDeposit = toBN(deposit0 * multiplier0);

                // Vehicle entry.
                const successEnterRoad = await operator.enterRoad.call(
                    booth1, hashed1, { from: vehicle1, value: paymentDeposit });
                assert.isTrue(successEnterRoad);
                const txObjEnter = await operator.enterRoad(
                        booth1, hashed1, { from: vehicle1, value: paymentDeposit });
                assert.strictEqual(txObjEnter.receipt.logs.length, 1);
                assert.strictEqual(txObjEnter.logs.length, 1);
                checkEntryLog(txObjEnter.logs[0], vehicle1, booth1, hashed1, 
                    toBN(multiplier0).toString(10), paymentDeposit.toString(10));
            });

            it("scenario 1", async function() {
                // Toll operator base deposit = deposit0
                // Route price = base route price * multiplier  
                // Route price = entry minimum = payment deposit = deposit0 * multiplier
                // ==> base route price = base deposit
                // No refund.

                // Set base route price.
                const baseRoutePrice = toBN(deposit0);
                const successRoutePrice = await operator.setRoutePrice.call(booth1, booth2, baseRoutePrice, { from: owner1 });
                assert.isTrue(successRoutePrice);
                const txObjRoutePrice = await operator.setRoutePrice(booth1, booth2, baseRoutePrice, { from: owner1 });
                assert.strictEqual(txObjRoutePrice.receipt.logs.length, 1);
                assert.strictEqual(txObjRoutePrice.logs.length, 1);
                checkSetRoutePriceLog(txObjRoutePrice.logs[0], owner1, booth1, booth2, baseRoutePrice.toString(10));
                    
                const vehBalBefore = await operator.getPayment.call(vehicle1, { from: vehicle1 });
                const ownerBalBefore = await operator.getPayment.call(owner1, { from: owner1 });
                
                // Vehicle exit.
                const result = await operator.reportExitRoad.call(secret1, { from: booth2 });
                assert.strictEqual(result.toNumber(), 1);
                const txObj = await operator.reportExitRoad(secret1, { from: booth2 });

                // Check that logged refund is 0.
                assert.strictEqual(txObj.receipt.logs.length, 1);
                assert.strictEqual(txObj.logs.length, 1);
                checkExitLog(txObj.logs[0], booth2, hashed1, paymentDeposit.toString(10), toBN(0).toString(10));

                // Check that contract balance has not changed.
                const vehBalAfter = await operator.getPayment.call(vehicle1, { from: vehicle1 });
                const ownerBalAfter = await operator.getPayment.call(owner1, { from: owner1 });

                assert.strictEqual(vehBalBefore.toString(10), vehBalAfter.toString(10), "Vehicle received some form of refund.");
                assert.strictEqual(ownerBalBefore.toString(10), ownerBalAfter.sub(paymentDeposit).toString(10), 
                    "Operator's contract balance incorrect.");
            });

            it("scenario 2", async function() {
                // Toll operator base deposit = deposit0
                // Route price = base route price * multiplier
                // Route price > payment deposit             
                // Payment deposit = entry minimum = deposit0 * multiplier
                // ==> base route price > base deposit
                // No refund.

                // Set base route price.
                const baseRoutePrice = toBN(deposit0 + 1);
                const successRoutePrice = await operator.setRoutePrice.call(booth1, booth2, baseRoutePrice, { from: owner1 });
                assert.isTrue(successRoutePrice);
                const txObjRoutePrice = await operator.setRoutePrice(booth1, booth2, baseRoutePrice, { from: owner1 });
                assert.strictEqual(txObjRoutePrice.receipt.logs.length, 1);
                assert.strictEqual(txObjRoutePrice.logs.length, 1);
                checkSetRoutePriceLog(txObjRoutePrice.logs[0], owner1, booth1, booth2, baseRoutePrice.toString(10));
                
                const vehBalBefore = await operator.getPayment.call(vehicle1, { from: vehicle1 });
                const ownerBalBefore = await operator.getPayment.call(owner1, { from: owner1 });
                        
                // Vehicle exit.
                const result = await operator.reportExitRoad.call(secret1, { from: booth2 });
                assert.strictEqual(result.toNumber(), 1);
                const txObj = await operator.reportExitRoad(secret1, { from: booth2 });

                // Check that logged refund is 0.
                assert.strictEqual(txObj.receipt.logs.length, 1);
                assert.strictEqual(txObj.logs.length, 1);
                checkExitLog(txObj.logs[0], booth2, hashed1, paymentDeposit.toString(10), toBN(0).toString(10));

                // Check that contract balance has not changed.
                const vehBalAfter = await operator.getPayment.call(vehicle1, { from: vehicle1 });
                const ownerBalAfter = await operator.getPayment.call(owner1, { from: owner1 });

                assert.strictEqual(vehBalBefore.toString(10), vehBalAfter.toString(10), "Vehicle received some form of refund.");
                assert.strictEqual(ownerBalBefore.toString(10), ownerBalAfter.sub(paymentDeposit).toString(10),
                    "Operator's contract balance incorrect.");
            });

            it("scenario 3", async function() {
                // Toll operator base deposit = deposit0
                // Route price = base route price * multiplier
                // Route price < entry minimum = deposit0 * multiplier
                // Payment deposit = entry minimum
                // ==> base route price < base deposit
                // Refund extra payment deposit.

                const baseRoutePrice = toBN(deposit0 - 1);
                const expectedRoutePrice = baseRoutePrice.mul(toBN(multiplier0));
                const expectedRefund = paymentDeposit.sub(expectedRoutePrice);

                // Set base route price.
                const successRoutePrice = await operator.setRoutePrice.call(booth1, booth2, baseRoutePrice, { from: owner1 });
                assert.isTrue(successRoutePrice);
                const txObjRoutePrice = await operator.setRoutePrice(booth1, booth2, baseRoutePrice, { from: owner1 });
                assert.strictEqual(txObjRoutePrice.receipt.logs.length, 1);
                assert.strictEqual(txObjRoutePrice.logs.length, 1);
                checkSetRoutePriceLog(txObjRoutePrice.logs[0], owner1, booth1, booth2, baseRoutePrice.toString(10));
                
                const vehBalBefore = await operator.getPayment.call(vehicle1, { from: vehicle1 });
                const ownerBalBefore = await operator.getPayment.call(owner1, { from: owner1 });
                        
                // Vehicle exit.
                const result = await operator.reportExitRoad.call(secret1, { from: booth2 });
                assert.strictEqual(result.toNumber(), 1);
                const txObj = await operator.reportExitRoad(secret1, { from: booth2 });

                // Check that logged refund is as expected.
                assert.strictEqual(txObj.receipt.logs.length, 1);
                assert.strictEqual(txObj.logs.length, 1);
                checkExitLog(txObj.logs[0], booth2, hashed1, 
                    expectedRoutePrice.toString(10), expectedRefund.toString(10));

                // Check that contract balance has changed correctly.
                const vehBalAfter = await operator.getPayment.call(vehicle1, { from: vehicle1 });
                const ownerBalAfter = await operator.getPayment.call(owner1, { from: owner1 });

                assert.strictEqual(vehBalBefore.toString(10), vehBalAfter.sub(expectedRefund).toString(10),
                    "Vehicle's contract balance incorrect.");
                assert.strictEqual(ownerBalBefore.toString(10), ownerBalAfter.sub(expectedRoutePrice).toString(10),
                    "Operator's contract balance incorrect.");
            });
        });

        describe("Tests where vehicle/first vehicle enters with paid deposit more than minimum required.", function() {
            let paymentDeposit;
            beforeEach("Set up first vehicle's entry.", async function() {
                paymentDeposit = toBN((deposit0 + 10) * multiplier0);

                // Vehicle entry.
                const successEnterRoad = await operator.enterRoad.call(
                    booth1, hashed1, { from: vehicle1, value: paymentDeposit });
                assert.isTrue(successEnterRoad);
                const txObjEnter = await operator.enterRoad(
                        booth1, hashed1, { from: vehicle1, value: paymentDeposit });
                assert.strictEqual(txObjEnter.receipt.logs.length, 1);
                assert.strictEqual(txObjEnter.logs.length, 1);
                checkEntryLog(txObjEnter.logs[0], vehicle1, booth1, hashed1, 
                    toBN(multiplier0).toString(10), paymentDeposit.toString(10));
            });

            it("scenario 4", async function() {
                // Toll operator base deposit = deposit0
                // Route price = base route price * multiplier
                // Route price = entry minimum = deposit0 * multiplier
                // ==> base route price = base deposit
                // Payment deposit > Route price
                // Refund extra payment deposit.

                const baseRoutePrice = toBN(deposit0);
                const expectedRoutePrice = baseRoutePrice.mul(toBN(multiplier0));
                const expectedRefund = paymentDeposit.sub(expectedRoutePrice);

                // Set base route price.
                const successRoutePrice = await operator.setRoutePrice.call(booth1, booth2, baseRoutePrice, { from: owner1 });
                assert.isTrue(successRoutePrice);
                const txObjRoutePrice = await operator.setRoutePrice(booth1, booth2, baseRoutePrice, { from: owner1 });
                assert.strictEqual(txObjRoutePrice.receipt.logs.length, 1);
                assert.strictEqual(txObjRoutePrice.logs.length, 1);
                checkSetRoutePriceLog(txObjRoutePrice.logs[0], owner1, booth1, booth2, baseRoutePrice.toString(10));
                        
                const vehBalBefore = await operator.getPayment.call(vehicle1, { from: vehicle1 });
                const ownerBalBefore = await operator.getPayment.call(owner1, { from: owner1 });

                // Vehicle exit.
                const result = await operator.reportExitRoad.call(secret1, { from: booth2 });
                assert.strictEqual(result.toNumber(), 1);
                const txObj = await operator.reportExitRoad(secret1, { from: booth2 });

                // Check that logged refund is as expected.
                assert.strictEqual(txObj.receipt.logs.length, 1);
                assert.strictEqual(txObj.logs.length, 1);
                checkExitLog(txObj.logs[0], booth2, hashed1, 
                    expectedRoutePrice.toString(10), expectedRefund.toString(10))

                // Check that contract balance has changed correctly.
                const vehBalAfter = await operator.getPayment.call(vehicle1, { from: vehicle1 });
                const ownerBalAfter = await operator.getPayment.call(owner1, { from: owner1 });

                assert.strictEqual(vehBalBefore.toString(10), vehBalAfter.sub(expectedRefund).toString(10), 
                    "Vehicle's contract balance incorrect.");
                assert.strictEqual(ownerBalBefore.toString(10), ownerBalAfter.sub(expectedRoutePrice).toString(10),
                    "Operator's contract balance incorrect.");
            });

            it("scenario 5", async function() {
                // Toll operator base deposit = deposit0
                // Route price = base route price * multiplier
                // Route price unknown.
                // Payment deposit > entry minimum = deposit0 * multiplier
                // Update: Route price < payment deposit
                // Refund extra payment deposit.

                const vehBalBefore = await operator.getPayment.call(vehicle1, { from: vehicle1 });
                const ownerBalBefore = await operator.getPayment.call(owner1, { from: owner1 });

                // Vehicle exit. Status = 2 for pending payment.
                const result = await operator.reportExitRoad.call(secret1, { from: booth2 });
                assert.strictEqual(result.toNumber(), 2);
                const txObjPending = await operator.reportExitRoad(secret1, { from: booth2 });

                // Check that the pending payment is logged correctly.
                assert.strictEqual(txObjPending.receipt.logs.length, 1);
                assert.strictEqual(txObjPending.logs.length, 1);
                checkPendingLog(txObjPending.logs[0], hashed1, booth1, booth2);

                // Set base route price.
                const baseRoutePrice = toBN(deposit0 + 3);
                const expectedRoutePrice = baseRoutePrice.mul(toBN(multiplier0));
                const expectedRefund = paymentDeposit.sub(expectedRoutePrice);

                const successRoutePrice = await operator.setRoutePrice.call(booth1, booth2, baseRoutePrice, { from: owner1 });
                assert.isTrue(successRoutePrice);
                const txObjRoutePrice = await operator.setRoutePrice(booth1, booth2, baseRoutePrice, { from: owner1 });
                assert.strictEqual(txObjRoutePrice.receipt.logs.length, 2);
                assert.strictEqual(txObjRoutePrice.logs.length, 2);

                checkSetRoutePriceLog(txObjRoutePrice.logs[0], owner1, booth1, booth2, baseRoutePrice.toString(10));

                checkExitLog(txObjRoutePrice.logs[1], booth2, hashed1, 
                        expectedRoutePrice.toString(10), expectedRefund.toString(10));

                // Check that contract balance has changed correctly.
                const vehBalAfter = await operator.getPayment.call(vehicle1, { from: vehicle1 });
                const ownerBalAfter = await operator.getPayment.call(owner1, { from: owner1 });

                assert.strictEqual(vehBalBefore.toString(10), vehBalAfter.sub(expectedRefund).toString(10), 
                    "Vehicle's contract balance incorrect.");
                assert.strictEqual(ownerBalBefore.toString(10), ownerBalAfter.sub(expectedRoutePrice).toString(10),
                    "Operator's contract balance incorrect.");
            });

            it("scenario 6", async function() {
                // Toll operator base deposit = deposit0
                // Route price = base route price * multiplier
                // Route price unknown.
                // Veh 1: Payment deposit > entry minimum = deposit0 * multiplier
                // Veh 2: Payment deposit = entry minimum = deposit0 * multiplier
                // Update: Route price < entry minimum
                // ==> base route price < deposit0
                // Veh 1 gets refunded first.
                // Call to clear payment. Veh 2 gets refunded.

                const paymentDeposit2 = toBN(deposit0 * multiplier0);
                const baseRoutePrice = toBN(deposit0 - 1);
                const expectedRoutePrice = baseRoutePrice.mul(toBN(multiplier0));
                const expectedRefund = paymentDeposit.sub(expectedRoutePrice);
                const expectedRefund2 = paymentDeposit2.sub(expectedRoutePrice);

                const veh1BalBefore = await operator.getPayment.call(vehicle1, { from: vehicle1 });
                const veh2BalBefore = await operator.getPayment.call(vehicle2, { from: vehicle2 });
                const ownerBalBefore = await operator.getPayment.call(owner1, { from: owner1 });

                // Vehicle 1 exit. Status = 2 for pending payment.
                const result = await operator.reportExitRoad.call(secret1, { from: booth2 });
                assert.strictEqual(result.toNumber(), 2);
                const txObjPending = await operator.reportExitRoad(secret1, { from: booth2 });

                // Check that the pending payment is logged correctly.
                assert.strictEqual(txObjPending.receipt.logs.length, 1);
                assert.strictEqual(txObjPending.logs.length, 1);
                checkPendingLog(txObjPending.logs[0], hashed1, booth1, booth2);


                // Vehicle 2 entry.
                const successEnterRoad2 = await operator.enterRoad.call(
                    booth1, hashed2, { from: vehicle2, value: paymentDeposit2 });
                assert.isTrue(successEnterRoad2);
                const txObjEnter2 = await operator.enterRoad(
                        booth1, hashed2, { from: vehicle2, value: paymentDeposit2 });
                assert.strictEqual(txObjEnter2.receipt.logs.length, 1);
                assert.strictEqual(txObjEnter2.logs.length, 1);
                checkEntryLog(txObjEnter2.logs[0], vehicle2, booth1, hashed2, 
                    toBN(multiplier0).toString(10), paymentDeposit2.toString(10));

                // Vehicle 2 exit. Status = 2 for pending payment.
                const result2 = await operator.reportExitRoad.call(secret2, { from: booth2 });
                assert.strictEqual(result2.toNumber(), 2);
                const txObjPending2 = await operator.reportExitRoad(secret2, { from: booth2 });

                // Check that the pending payment is logged correctly.
                assert.strictEqual(txObjPending2.receipt.logs.length, 1);
                assert.strictEqual(txObjPending2.logs.length, 1);
                checkPendingLog(txObjPending2.logs[0], hashed2, booth1, booth2);

                // Set base route price.
                const successRoutePrice = await operator.setRoutePrice.call(booth1, booth2, baseRoutePrice, { from: owner1 });
                assert.isTrue(successRoutePrice);
                const txObjRoutePrice = await operator.setRoutePrice(booth1, booth2, baseRoutePrice, { from: owner1 });
                
                assert.strictEqual(txObjRoutePrice.receipt.logs.length, 2);
                assert.strictEqual(txObjRoutePrice.logs.length, 2);

                checkSetRoutePriceLog(txObjRoutePrice.logs[0], owner1, booth1, booth2, baseRoutePrice.toString(10));               

                // check vehicle 1's pending payment is cleared.
                checkExitLog(txObjRoutePrice.logs[1], booth2, hashed1, 
                    expectedRoutePrice.toString(10), expectedRefund.toString(10));

                await expectedExceptionPromise(
                    () => operator.clearSomePendingPayments(
                        booth1, booth2, 5, { from: someoneElse }),
                    maxGas);    // should not be able to clear more than the existing number of pending payments,
                                // which in this case is 1.

                // Clear vehicle 2's pending payment.
                const clearSuccess = await operator.clearSomePendingPayments.call(booth1, booth2, 1, { from: someoneElse });
                assert.isTrue(clearSuccess);
                const txObjClear = await operator.clearSomePendingPayments(booth1, booth2, 1, { from: someoneElse });
                assert.strictEqual(txObjClear.receipt.logs.length, 1);
                assert.strictEqual(txObjClear.logs.length, 1);

                // Check that the payment clearing is logged correctly.
                checkExitLog(txObjClear.logs[0], booth2, hashed2,
                    expectedRoutePrice.toString(10), expectedRefund2.toString(10));

                // Check that contract balances have changed correctly.
                const veh1BalAfter = await operator.getPayment.call(vehicle1, { from: vehicle1 });
                const veh2BalAfter = await operator.getPayment.call(vehicle2, { from: vehicle2 });
                const ownerBalAfter = await operator.getPayment.call(owner1, { from: owner1 });

                assert.strictEqual(veh1BalBefore.toString(10), veh1BalAfter.sub(expectedRefund).toString(10),
                    "Vehicle 1's contract balance incorrect.");
                assert.strictEqual(veh2BalBefore.toString(10), veh2BalAfter.sub(expectedRefund2).toString(10),
                    "Vehicle 2's contract balance incorrect.");
                assert.strictEqual(ownerBalBefore.toString(10), 
                    ownerBalAfter.sub(expectedRoutePrice).sub(expectedRoutePrice).toString(10),
                    "Operator's contract balance incorrect.");
            });
        });
    });

});
