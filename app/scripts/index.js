const Web3 = require("web3");
const Promise = require("bluebird");
const truffleContract = require("truffle-contract");
const $ = require("jquery");
const regulatorJson = require("../../build/contracts/Regulator.json");
const tbOperatorJson = require("../../build/contracts/TollBoothOperator.json");
const toBN = Web3.utils.toBN;
const toBytes32 = require("../../utils/toBytes32.js");
// const initialOperatorAddr = require("../../migrations/2_deploy_contracts.js");

// console.log(initialOperatorAddr);


let regulatorOwner, deployed, tbOperatorContract;
let tbOpContractAddress = null;
let tbOperatorOwner = null;
let currentDeposit = null;
// // Supports Metamask, and other wallets that provide / inject 'web3'.
// if (typeof web3 !== 'undefined') {
//     // Use the Mist/wallet/Metamask provider.
//     window.web3 = new Web3(web3.currentProvider);
// } else {
//     // Your preferred fallback.
    window.web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545')); 
// }


const Regulator = truffleContract(regulatorJson);
Regulator.setProvider(web3.currentProvider);
const TollBoothOperator = truffleContract(tbOperatorJson);
TollBoothOperator.setProvider(web3.currentProvider);


// table functions

const addCell = function(row, value) {
    let cell = document.createElement('cell');
    cell.innerHTML = value;
    row.appendChild(cell);
  }

const roadEntryTableRow = function (table, vehicle, entryBooth, exitSecretHashed, multiplier, depositedWeis){
    let row = document.createElement('row');
    addCell(row, vehicle);
    addCell(row, entryBooth);
    addCell(row, exitSecretHashed);
    addCell(row, multiplier);
    addCell(row, depositedWeis);

    table.appendChild(row);
}

const roadEntryTableBuilder = function(logs){

    console.log('abc:', logs);

    const table = document.getElementById('entryTbl');
    roadEntryTableRow(table, "Vehicle", "Entry Booth", "Exit Secret Hashed", "Multiplier", "Deposited Weis");

    for (i = 0; i < logs.length; i++){

        roadEntryTableRow(table,
            logs[i].args.vehicle,
            logs[i].args.entryBooth,
            logs[i].args.exitSecretHashed,
            logs[i].args.multiplier,
            logs[i].args.depositedWeis,
            )
    }
}

const getEntryExitHistoryAction = async function() {
    if(tbOperatorOwner == null){
        $("#entryTbl").html("Please specify a valid Toll Booth Operator Contract Address first.");
    }else{
        try{
            const vehAddr = $("input[list='indVehAddr']").val();
            const pastEvents = await tbOperatorContract.getPastEvents("LogRoadEntered",
            { filter: {vehicle: vehAddr }, fromBlock:0, toBlock:'latest' });

console.log(vehAddr, pastEvents);

            if (pastEvents.length == 0){
                $("#entryTbl").html("No records found.");
            }else{
                roadEntryTableBuilder(pastEvents);
            }

        } catch (e){
            $("#entryTbl").html(e.toString());
        }
    }
};

const pendingPaymentsCount = async function() {
    const entryB = $("input[list='entryB']").val();
    const exitB = $("input[list='exitB']").val();

    const res = await tbOperatorContract.getPendingPaymentCount.call(entryB, exitB);
    console.log(res.toString(10));
}

const reportExitAction = async function() {
    if(tbOperatorOwner == null){
        $("#reportExitTxCreated").html("Please specify a valid Toll Booth Operator Contract Address first.");
    }else{
        try{
            const gas = 300000; 
            let txId;
            const exitSecret = web3.utils.fromAscii($("input[name='exitSecret']").val());
            const exitTollBooth = $("input[list='exitTollBooth']").val();

            let simResult = await tbOperatorContract.reportExitRoad.call(
                exitSecret,
                {
                from: exitTollBooth,
                gas: gas
                }
            );
            
            if ((simResult != 1) && (simResult != 2)) {
                throw new Error("The transaction will fail anyway, not sending");
            }

            await tbOperatorContract.reportExitRoad(
                exitSecret,
                {
                from: exitTollBooth,
                gas: gas
                }
            )
            .on(
                "transactionHash",
                txHash => {
                    txId = txHash;
                    $("#reportExitTxCreated").html("Created Transaction: " + txHash);
                    $("#reportExitTxReceipt").html("");
                    $("#logReportExitEvent").html("");
                    $("#logReportExitExitBooth").html("");
                    $("#logReportExitExitSecretHashed").html("");
                    $("#logReportExitFinalFee").html("");
                    $("#logReportExitRefundWeis").html("");
                }
            )
            .on(
                "receipt", receipt =>{
                    if (!receipt.status) {
                        console.error("Wrong status");
                        console.error(receipt);
                        $("#reportExitTxReceipt").html("There was an error in the tx execution, status not 1");
                        $("#logReportExitEvent").html("");
                        $("#logReportExitExitBooth").html("");
                        $("#logReportExitExitSecretHashed").html("");
                        $("#logReportExitFinalFee").html("");
                        $("#logReportExitRefundWeis").html("");

                    } else if (receipt.logs.length == 0) {
                        console.error("Empty logs");
                        console.error(receipt);
                        $("#reportExitTxReceipt").html("There was an error in the tx execution, missing expected event");
                        $("#logReportExitEvent").html("");
                        $("#logReportExitExitBooth").html("");
                        $("#logReportExitExitSecretHashed").html("");
                        $("#logReportExitFinalFee").html("");
                        $("#logReportExitRefundWeis").html("");
                    } else {
                        $("#reportExitTxReceipt").html("Transfer executed. Tx ID: " + txId);
                        const eventName = receipt.logs[0].event;
                        $("#logReportExitEvent").html("Event Name: " + eventName);
                        if (eventName == 'LogRoadExited'){
                            $("#logReportExitExitBooth").html("Exit Booth: " + receipt.logs[0].args.exitBooth);
                            $("#logReportExitExitSecretHashed").html("Exit Secret Hashed: " + receipt.logs[0].args.exitSecretHashed);
                            $("#logReportExitFinalFee").html("Final Fee: " + receipt.logs[0].args.finalFee);
                            $("#logReportExitRefundWeis").html("Refund Weis: " + receipt.logs[0].args.refundWeis);
                        } else if(eventName == 'LogPendingPayment'){

                            console.log(receipt.logs[0]);
                            $("#logReportExitExitBooth").html("Exit Booth: " + receipt.logs[0].args.exitBooth);
                            $("#logReportExitExitSecretHashed").html("Exit Secret Hashed: " + receipt.logs[0].args.exitSecretHashed);
                            $("#logReportExitFinalFee").html("Entry Booth: " + receipt.logs[0].args.entryBooth);
                            $("#logReportExitRefundWeis").html("");
                        }else{
                            $("#logReportExitExitBooth").html("");
                            $("#logReportExitExitSecretHashed").html("");
                            $("#logReportExitFinalFee").html("");
                            $("#logReportExitRefundWeis").html("");
                        }
                    }
                }       
            )
        } catch (e){
            let errorString = e.toString();
            if (errorString.includes("invalid address")){
                errorString = "Tx not created. Please check input addresses.";
            }
            $("#reportExitTxCreated").html(errorString);
            $("#reportExitTxReceipt").html("");
            $("#logReportExitEvent").html("");
            $("#logReportExitExitBooth").html("");
            $("#logReportExitExitSecretHashed").html("");
            $("#logReportExitFinalFee").html("");
            $("#logReportExitRefundWeis").html("");
            console.error(e);
        }
    }
};

const roadEnteredAction = async function() {
    if(tbOperatorOwner == null){
        $("#roadEnteredTxCreated").html("Please specify a valid Toll Booth Operator Contract Address first.");
    }else{
        try{
            const gas = 300000; 
            let txId;
            const secret = web3.utils.fromAscii($("input[name='secret']").val());
            let exitSecretHashed = await tbOperatorContract.hashSecret.call(secret);
            const entryDeposit = toBN($("input[name='entryDeposit']").val());
            const entryBoothAddr = $("input[list='entryBoothAddr']").val();
            const vehAddr = $("input[list='indVehAddr']").val();

            let simResult = await tbOperatorContract.enterRoad.call(
                entryBoothAddr,
                exitSecretHashed,
                {
                from: vehAddr,
                value: entryDeposit,
                gas: gas
                }
            );
            
            if (!simResult) {
                throw new Error("The transaction will fail anyway, not sending");
            }

            await tbOperatorContract.enterRoad(
                entryBoothAddr,
                exitSecretHashed,
                {
                from: vehAddr,
                value: entryDeposit,
                gas: gas
                }
            )
            .on(
                "transactionHash",
                txHash => {
                    txId = txHash;
                    $("#roadEnteredTxCreated").html("Created Transaction: " + txHash);
                    $("#roadEnteredTxReceipt").html("");
                    $("#logRoadEnteredEvent").html("");
                    $("#logRoadEnteredVehicle").html("");
                    $("#logRoadEnteredEntryBooth").html("");
                    $("#logRoadEnteredExitSecretHashed").html("");
                    $("#logRoadEnteredEntryMultiplier").html("");
                    $("#logRoadEnteredEntryDepositedWeis").html("");
                }
            )
            .on(
                "receipt", receipt =>{
                    if (!receipt.status) {
                        console.error("Wrong status");
                        console.error(receipt);
                        $("#roadEnteredTxReceipt").html("There was an error in the tx execution, status not 1");
                        $("#logRoadEnteredEvent").html("");
                        $("#logRoadEnteredVehicle").html("");
                        $("#logRoadEnteredEntryBooth").html("");
                        $("#logRoadEnteredExitSecretHashed").html("");
                        $("#logRoadEnteredEntryMultiplier").html("");
                        $("#logRoadEnteredEntryDepositedWeis").html("");

                    } else if (receipt.logs.length == 0) {
                        console.error("Empty logs");
                        console.error(receipt);
                        $("#roadEnteredTxReceipt").html("There was an error in the tx execution, missing expected event");
                        $("#logRoadEnteredEvent").html("");
                        $("#logRoadEnteredVehicle").html("");
                        $("#logRoadEnteredEntryBooth").html("");
                        $("#logRoadEnteredExitSecretHashed").html("");
                        $("#logRoadEnteredEntryMultiplier").html("");
                        $("#logRoadEnteredEntryDepositedWeis").html("");
                    } else {
                        $("#roadEnteredTxReceipt").html("Transfer executed. Tx ID: " + txId);
                        $("#logRoadEnteredEvent").html("Event Name: " + receipt.logs[0].event);
                        $("#logRoadEnteredVehicle").html("Vehicle: " + receipt.logs[0].args.vehicle);
                        $("#logRoadEnteredEntryBooth").html("Entry Booth: " + receipt.logs[0].args.entryBooth);
                        $("#logRoadEnteredExitSecretHashed").html("Hash: " + receipt.logs[0].args.exitSecretHashed);
                        $("#logRoadEnteredEntryMultiplier").html("Multiplier: " + receipt.logs[0].args.multiplier);
                        $("#logRoadEnteredEntryDepositedWeis").html("Deposited Weis: " + receipt.logs[0].args.depositedWeis);
                    }
                }       
            )
        } catch (e){
            let errorString = e.toString();
            if (errorString.includes("invalid address")){
                errorString = "Tx not created. Please check input addresses.";
            }
            $("#roadEnteredTxCreated").html(errorString);
            $("#roadEnteredTxReceipt").html("");
            $("#logRoadEnteredEvent").html("");
            $("#logRoadEnteredVehicle").html("");
            $("#logRoadEnteredEntryBooth").html("");
            $("#logRoadEnteredExitSecretHashed").html("");
            $("#logRoadEnteredEntryMultiplier").html("");
            $("#logRoadEnteredEntryDepositedWeis").html("");
            console.error(e);
        }
    }
};

const checkRoutePriceAction = async function() {
    if(tbOperatorOwner == null){
        $("#currentRoutePrice").html("Please specify a valid Toll Booth Operator Contract Address first.");
    }else{
        try{
            const rpEntryBooth = $("input[list='rpEntryBooth']").val();
            const rpExitBooth = $("input[list='rpExitBooth']").val();

            const currentRoutePrice = await tbOperatorContract.getRoutePrice(rpEntryBooth, rpExitBooth);

            $("#currentRoutePrice").html("Current Base Route Price: " + currentRoutePrice.toString(10) + " Weis");
        } catch (e) {
            $("#currentRoutePrice").html(e.toString());
            console.error(e);
        }
    }
};

const updateRoutePriceAction = async function() {
    if(tbOperatorOwner == null){
        $("#setRoutePriceTxCreated").html("Please specify a valid Toll Booth Operator Contract Address first.");
    }else{
        try{
            const gas = 300000; 
            let txId;
            const rpEntryBooth = $("input[list='rpEntryBooth']").val();
            const rpExitBooth = $("input[list='rpExitBooth']").val();
            const newRoutePrice = toBN($("input[name='newRoutePrice']").val());

            let simResult = await tbOperatorContract.setRoutePrice.call(
                rpEntryBooth,
                rpExitBooth,
                newRoutePrice,
                {
                from: tbOperatorOwner,
                gas: gas
                }
            );
            
            if (!simResult) {
                throw new Error("The transaction will fail anyway, not sending");
            }

            await tbOperatorContract.setRoutePrice(
                rpEntryBooth,
                rpExitBooth,
                newRoutePrice,
                {
                from: tbOperatorOwner,
                gas: gas
                }
            )
            .on(
                "transactionHash",
                txHash => {
                    txId = txHash;
                    $("#setRoutePriceTxCreated").html("Created Transaction: " + txHash);
                    $("#setRoutePriceTxReceipt").html("");
                    $("#logSetRoutePriceEvent").html("");
                    $("#logSetRoutePriceEntryBooth").html("");
                    $("#logSetRoutePriceExitBooth").html("");
                    $("#logSetRoutePricePriceWeis").html("");
                }
            )
            .on(
                "receipt", receipt =>{
                    if (!receipt.status) {
                        console.error("Wrong status");
                        console.error(receipt);
                        $("#setRoutePriceTxReceipt").html("There was an error in the tx execution, status not 1");
                        $("#logSetRoutePriceEvent").html("");
                        $("#logSetRoutePriceEntryBooth").html("");
                        $("#logSetRoutePriceExitBooth").html("");
                        $("#logSetRoutePricePriceWeis").html("");

                    } else if (receipt.logs.length == 0) {
                        console.error("Empty logs");
                        console.error(receipt);
                        $("#setRoutePriceTxReceipt").html("There was an error in the tx execution, missing expected event");
                        $("#logSetRoutePriceEvent").html("");
                        $("#logSetRoutePriceEntryBooth").html("");
                        $("#logSetRoutePriceExitBooth").html("");
                        $("#logSetRoutePricePriceWeis").html("");
                    } else {
                        $("#setRoutePriceTxReceipt").html("Transfer executed. Tx ID: " + txId);
                        $("#logSetRoutePriceEvent").html("Event Name: " + receipt.logs[0].event);
                        $("#logSetRoutePriceEntryBooth").html("Entry Booth: " + receipt.logs[0].args.entryBooth);
                        $("#logSetRoutePriceExitBooth").html("Exit Booth: " + receipt.logs[0].args.exitBooth);
                        $("#logSetRoutePricePriceWeis").html("Price (Weis): " + receipt.logs[0].args.priceWeis);
                    }
                }       
            )
        } catch (e){
            let errorString = e.toString();
            if (errorString.includes("invalid address")){
                errorString = "Tx not created. Please check input addresses.";
            }
            $("#setRoutePriceTxCreated").html(errorString);
            $("#setRoutePriceTxReceipt").html("");
            $("#logSetRoutePriceEvent").html("");
            $("#logSetRoutePriceEntryBooth").html("");
            $("#logSetRoutePriceExitBooth").html("");
            $("#logSetRoutePricePriceWeis").html("");
            console.error(e);
        }
    }
};

const checkMinDepositAction = async function() {
    if(tbOperatorOwner == null){
        $("#minDeposit").html("Please specify a valid Toll Booth Operator Contract Address first.");
    }else{
        try{
            const vehAddr = $("input[list='indVehAddr']").val();
            const vehType = await deployed.getVehicleType.call(vehAddr);
            const deposit = await tbOperatorContract.getDeposit.call();
            const multiplier = await tbOperatorContract.getMultiplier.call(vehType);
            const minDeposit = multiplier.mul(deposit);

            console.log(vehAddr, vehType.toString(10), minDeposit.toString(10));

            if (vehType.toString(10) == '0'){
                $("#minDeposit").html("Vehicle is not registered with this Regulator.");
            } else if (multiplier.toString(10) == '0'){
                $("#minDeposit").html("Vehicle is unauthorized for entry.");
            } else{
                $("#minDeposit").html("Minimum Deposit (weis): " + minDeposit.toString(10));
            }
        } catch (e) {
            $("#minDeposit").html(e.toString());
            console.error(e);
        }
    }
};

const checkBalanceAction = async() => {
    try{
        let amount = toBN(await web3.eth.getBalance($("input[list='indVehAddr']").val()));
        $("#vehBalance").html("Current balance is " + amount.toString(10) + " weis.");
    } catch (e) {
        $("#vehBalance").html(e.toString());
        console.error(e);
    }
};

const checkTollBoothAction = async function() {
    if(tbOperatorOwner == null){
        $("#tollBoothStatus").html("Please specify a valid Toll Booth Operator Contract Address first.");
    }else{
        try{
            const tbAddr = $("input[list='tbAddr']").val();
            const isTollBooth = await tbOperatorContract.isTollBooth.call(tbAddr);

            if (isTollBooth){
                $("#tollBoothStatus").html(tbAddr + " is a Toll Booth registered with Operator " + tbOperatorContract.address);
            } else{
                $("#tollBoothStatus").html(tbAddr + " is NOT registered with Operator " + tbOperatorContract.address);
            }
        } catch (e) {
            $("#tollBoothStatus").html(e.toString());
            console.error(e);
        }
    }
};

const checkMultiplierAction = async function() {
    if(tbOperatorOwner == null){
        $("#currentMultiplier").html("Please specify a valid Toll Booth Operator Contract Address first.");
    }else{
        try{
            const vehType = $("input[name='vehTypeForMultiplier']").val();
            // let deployed = await Regulator.deployed();
            const currentMultiplier = await tbOperatorContract.getMultiplier.call(vehType);
            $("#currentMultiplier").html("Current Multiplier: " + currentMultiplier.toString(10));
        } catch (e) {
            $("#currentMultiplier").html(e.toString());
            console.error(e);
        }
    }
};


const updateMultiplierAction = async function() {
    if(tbOperatorOwner == null){
        $("#setMultiplierTxCreated").html("Please specify a valid Toll Booth Operator Contract Address first.");
    }else{
        try{
            const gas = 300000; 
            let txId;
            const vehType = $("input[name='vehTypeForMultiplier']").val();
            const newMultiplier = $("input[name='newMultiplier']").val();
            let simResult = await tbOperatorContract.setMultiplier.call(
                vehType,
                newMultiplier,
                {
                from: tbOperatorOwner,
                gas: gas
                }
            );
            
            if (!simResult) {
                throw new Error("The transaction will fail anyway, not sending");
            }

            await tbOperatorContract.setMultiplier(
                vehType,
                newMultiplier,
                {
                from: tbOperatorOwner,
                gas: gas
                }
            )
            .on(
                "transactionHash",
                txHash => {
                    txId = txHash;
                    $("#setMultiplierTxCreated").html("Created Transaction: " + txHash);
                    $("#setMultiplierTxReceipt").html("");
                    $("#logSetMultiplierEvent").html("");
                    $("#logSetMultiplierVehicleType").html("");
                    $("#logSetMultiplierMultiplier").html("");
                }
            )
            .on(
                "receipt", receipt =>{
                    if (!receipt.status) {
                        console.error("Wrong status");
                        console.error(receipt);
                        $("#setMultiplierTxReceipt").html("There was an error in the tx execution, status not 1");
                        $("#logSetMultiplierEvent").html("");
                        $("#logSetMultiplierVehicleType").html("");
                        $("#logSetMultiplierMultiplier").html("");

                    } else if (receipt.logs.length == 0) {
                        console.error("Empty logs");
                        console.error(receipt);
                        $("#setMultiplierTxReceipt").html("There was an error in the tx execution, missing expected event");
                        $("#logSetMultiplierEvent").html("");
                        $("#logSetMultiplierVehicleType").html("");
                        $("#logSetMultiplierMultiplier").html("");
                    } else {
                        $("#setMultiplierTxReceipt").html("Transfer executed. Tx ID: " + txId);
                        $("#logSetMultiplierEvent").html("Event Name: " + receipt.logs[0].event);
                        $("#logSetMultiplierVehicleType").html("Vehicle Type: " + receipt.logs[0].args.vehicleType.toString(10));
                        $("#logSetMultiplierMultiplier").html("Amount: " + receipt.logs[0].args.multiplier.toString(10));
                        $("#currentMultiplier").html("Current Multiplier: " +receipt.logs[0].args.multiplier.toString(10));
                    }
                }       
            )
        } catch (e){
            let errorString = e.toString();
            if (errorString.includes("invalid address")){
                errorString = "Tx not created. Please check input addresses.";
            }
            $("#setMultiplierTxCreated").html(errorString);
            $("#setMultiplierTxReceipt").html("");
            $("#logSetMultiplierEvent").html("");
            $("#logSetMultiplierVehicleType").html("");
            $("#logSetMultiplierMultiplier").html("");
            console.error(e);
        }
    }
};

const updateDepositAction = async function() {
    if(currentDeposit == null){
        $("#currentDeposit").html("Please specify a valid Toll Booth Operator Contract Address first.");
    }else{
        try{
            const gas = 300000; 
            let txId;
            const newDeposit = toBN($("input[name='newDeposit']").val());

            let simResult = await tbOperatorContract.setDeposit.call(
                newDeposit,
                {
                from: tbOperatorOwner,
                gas: gas
                }
            );
            
            if (!simResult) {
                throw new Error("The transaction will fail anyway, not sending");
            }

            await tbOperatorContract.setDeposit(
                newDeposit,
                {
                from: tbOperatorOwner,
                gas: gas
                }
            )
            .on(
                "transactionHash",
                txHash => {
                    txId = txHash;
                    $("#setDepositTxCreated").html("Created Transaction: " + txHash);
                    $("#setDepositTxReceipt").html("");
                    $("#logSetDepositEvent").html("");
                    $("#logSetDepositSender").html("");
                    $("#logSetDepositAmount").html("");
                }
            )
            .on(
                "receipt", receipt =>{
                    if (!receipt.status) {
                        console.error("Wrong status");
                        console.error(receipt);
                        $("#setDepositTxReceipt").html("There was an error in the tx execution, status not 1");
                        $("#logSetDepositEvent").html("");
                        $("#logSetDepositSender").html("");
                        $("#logSetDepositAmount").html("");

                    } else if (receipt.logs.length == 0) {
                        console.error("Empty logs");
                        console.error(receipt);
                        $("#setDepositTxReceipt").html("There was an error in the tx execution, missing expected event");
                        $("#logSetDepositEvent").html("");
                        $("#logSetDepositSender").html("");
                        $("#logSetDepositAmount").html("");
                    } else {
                        $("#setDepositTxReceipt").html("Transfer executed. Tx ID: " + txId);
                        $("#logSetDepositEvent").html("Event Name: " + receipt.logs[0].event);
                        $("#logSetDepositSender").html("Sender: " + receipt.logs[0].args.sender);
                        $("#logSetDepositAmount").html("Amount: " + receipt.logs[0].args.depositWeis.toString(10));
                        currentDeposit = newDeposit;
                        $("#currentDeposit").html("Current deposit is: " + currentDeposit.toString(10) + " Weis");
                    }
                }       
            )
        } catch (e){
            let errorString = e.toString();
            if (errorString.includes("invalid address")){
                errorString = "Tx not created. Please check input addresses.";
            }
            $("#setDepositTxCreated").html(errorString);
            $("#setDepositTxReceipt").html("");
            $("#logSetDepositEvent").html("");
            $("#logSetDepositSender").html("");
            $("#logSetDepositAmount").html("");
            console.error(e);
        }
    }
};

const getCurrentOperator = async function(addr) {
    try{
        if(await deployed.isOperator.call(addr)){
        tbOperatorContract = await TollBoothOperator.at(addr);
        tbOperatorOwner = await tbOperatorContract.getOwner.call();
        currentDeposit = await tbOperatorContract.getDeposit.call();
        const pausedStatus = await tbOperatorContract.isPaused.call();
        $("#tbOpContract").html("Toll Booth Operator Contract at: " + addr);
        $("#tbOpOwner").html("Toll Booth Operator Owner: " + tbOperatorOwner);
        $("#currentDeposit").html("Current deposit is: " + currentDeposit.toString(10) + " Weis");

        if (pausedStatus){
            $("#pausedStatus").html("Status: Paused");
        } else{
            $("#pausedStatus").html("Status: Active");
        }
        
        }else{
            tbOperatorContract = null;
            tbOperatorOwner = null;
            currentDeposit = null;
            $("#tbOpContract").html("Toll Booth Operator contract not found.");
            $("#tbOpOwner").html("");
            $("#pausedStatus").html("");
            $("#currentDeposit").html("Current deposit not found.");
        }
    } catch (e){
        let errorString = e.toString();
        $("#tbOpContract").html(errorString);
        $("#tbOpOwner").html("");
        $("#pausedStatus").html("");
        $("#currentDeposit").html("Current deposit not found.");
        console.error(e);
    }
}

const specifyOperatorAddrAction = async function() {
        const addr = $("input[name='tbOpContractAddress']").val();

        await getCurrentOperator(addr);
};

const unpauseOperatorAction = async function() {
    if(tbOperatorOwner == null){
        $("#pausedStatus").html("Please specify a valid Toll Booth Operator Contract Address first.");
    }else{
        try{
            const gas = 300000;
            const simResult = await tbOperatorContract.setPaused.call(0, { from: tbOperatorOwner, gas: gas });
            if (!simResult) { throw new Error("The transaction will fail anyway, not sending"); }
            await tbOperatorContract.setPaused(0, { from: tbOperatorOwner, gas: gas });
            $("#pausedStatus").html("Status: Active");
        } catch(e){
            $("#pausedStatus").html(e.toString());
        }
    }
}

const pauseOperatorAction = async function() {
    if(tbOperatorOwner == null){
        $("#pausedStatus").html("Please specify a valid Toll Booth Operator Contract Address first.");
    }else{
        try{
            const gas = 300000;
            const simResult = await tbOperatorContract.setPaused.call(1, { from: tbOperatorOwner, gas: gas });
            if (!simResult) { throw new Error("The transaction will fail anyway, not sending"); }
            await tbOperatorContract.setPaused(1, { from: tbOperatorOwner, gas: gas });
            $("#pausedStatus").html("Status: Paused");
        } catch(e){
            $("#pausedStatus").html(e.toString());
        }
    }
}

const addTollBoothAction = async function() {
    if(tbOperatorOwner == null){
        $("#addTollBoothTxCreated").html("Please specify a valid Toll Booth Operator Contract Address first.");
    }else{
        try{
            const gas = 300000; 
            let txId;
            const tbAddr = $("input[list='tbAddr']").val();
            let simResult = await tbOperatorContract.addTollBooth.call(
                tbAddr,
                {
                from: tbOperatorOwner,
                gas: gas
                }
            );
            
            if (!simResult) {
                throw new Error("The transaction will fail anyway, not sending");
            }

            await tbOperatorContract.addTollBooth(
                tbAddr,
                {
                from: tbOperatorOwner,
                gas: gas
                }
            )
            .on(
                "transactionHash",
                txHash => {
                    txId = txHash;
                    $("#addTollBoothTxCreated").html("Created Transaction: " + txHash);
                    $("#addTollBoothTxReceipt").html("");
                    $("#logaddTollBoothEvent").html("");
                    $("#logaddTollBoothSender").html("");
                    $("#logaddTollBoothTollBooth").html("");
                }
            )
            .on(
                "receipt", receipt =>{
                    if (!receipt.status) {
                        console.error("Wrong status");
                        console.error(receipt);
                        $("#addTollBoothTxReceipt").html("There was an error in the tx execution, status not 1");
                        $("#logaddTollBoothEvent").html("");
                        $("#logaddTollBoothSender").html("");
                        $("#logaddTollBoothTollBooth").html("");
                    } else if (receipt.logs.length == 0) {
                        console.error("Empty logs");
                        console.error(receipt);
                        $("#addTollBoothTxReceipt").html("There was an error in the tx execution, missing expected event");
                        $("#logaddTollBoothEvent").html("");
                        $("#logaddTollBoothSender").html("");
                        $("#logaddTollBoothTollBooth").html("");
                    } else {                    
                        $("#addTollBoothTxReceipt").html("Transfer executed. Tx ID: " + txId);
                        $("#logaddTollBoothEvent").html("Event Name: " + receipt.logs[0].event);
                        $("#logaddTollBoothSender").html("Sender: " + receipt.logs[0].args.sender);
                        $("#logaddTollBoothTollBooth").html("Toll Booth Address: "+ receipt.logs[0].args.tollBooth);
                    }
                }       
            )
        } catch (e){
            let errorString = e.toString();
            if (errorString.includes("invalid address")){
                errorString = "Tx not created. Please check input addresses.";
            }
            $("#addTollBoothTxCreated").html(errorString);
            $("#addTollBoothTxReceipt").html("");
            $("#logaddTollBoothEvent").html("");
            $("#logaddTollBoothSender").html("");
            $("#logaddTollBoothTollBooth").html("");
            console.error(e);
        }
    }
};

const setVehTypeAction = async function() {
    try{
        const gas = 300000; 
        let txId;
        const vehAddr = $("input[list='vehAddr']").val();
        const vehType = toBN($("input[name='vehType']").val());
        // let deployed = await Regulator.deployed();
        let simResult = await deployed.setVehicleType.call(
            vehAddr,
            vehType,
            {
            from: regulatorOwner,
            gas:gas
            }
        );
        
        if (!simResult) {
            throw new Error("The transaction will fail anyway, not sending");
        }

        await deployed.setVehicleType(
            vehAddr,
            vehType,
            {
            from: regulatorOwner,
            gas:gas
            }
        )
        .on(
            "transactionHash",
            txHash => {
                txId = txHash;
                $("#setVehTxCreated").html("Created Transaction: " + txHash);
                $("#setVehTxReceipt").html("");
                $("#logVehTypeSetEvent").html("");
                $("#logVehTypeSetSender").html("");
                $("#logVehTypeSetVehicle").html("");
                $("#logVehTypeSetVehType").html("");
            }
        )
        .on(
            "receipt", receipt =>{
                if (!receipt.status) {
                    console.error("Wrong status");
                    console.error(receipt);
                    $("#setVehTxReceipt").html("There was an error in the tx execution, status not 1");
                    $("#logVehTypeSetEvent").html("");
                    $("#logVehTypeSetSender").html("");
                    $("#logVehTypeSetVehicle").html("");
                    $("#logVehTypeSetVehType").html("");
                } else if (receipt.logs.length == 0) {
                    console.error("Empty logs");
                    console.error(receipt);
                    $("#setVehTxReceipt").html("There was an error in the tx execution, missing expected event");
                    $("#logVehTypeSetEvent").html("");
                    $("#logVehTypeSetSender").html("");
                    $("#logVehTypeSetVehicle").html("");
                    $("#logVehTypeSetVehType").html("");
                } else {
                    $("#setVehTxReceipt").html("Transfer executed. Tx ID: " + txId);
                    $("#logVehTypeSetEvent").html("Event Name: " + receipt.logs[0].event);
                    $("#logVehTypeSetSender").html("Sender: "
                    +receipt.logs[0].args.sender);
                    $("#logVehTypeSetVehicle").html("Vehicle Address: "+receipt.logs[0].args.vehicle);
                    $("#logVehTypeSetVehType").html("Vehicle Type: "+receipt.logs[0].args.vehicleType.toString(10));
                }
            }       
        )
    } catch (e){
        let errorString = e.toString();
        if (errorString.includes("invalid address")){
            errorString = "Tx not created. Please check input addresses.";
        }
        $("#setVehTxCreated").html(errorString);
        $("#setVehTxReceipt").html("");
        $("#logVehTypeSetEvent").html("");
        $("#logVehTypeSetSender").html("");
        $("#logVehTypeSetVehicle").html("");
        $("#logVehTypeSetVehType").html("");
        console.error(e);
    }
};

const createOperatorAction = async function() {
    try{
        const gas = 15000000; 
        let txId;
        const oprAddr = $("input[list='oprAddr']").val();
        const initialDeposit = toBN($("input[name='initialDeposit']").val());

        // let deployed = await Regulator.deployed();
        let simResult = await deployed.createNewOperator.call(
            oprAddr,
            initialDeposit,
            {
            from: regulatorOwner,
            gas:gas
            }
        );
        
        if (!simResult) {
            throw new Error("The transaction will fail anyway, not sending");
        }
        await deployed.createNewOperator(
            oprAddr,
            initialDeposit,
            {
            from: regulatorOwner,
            gas:gas
            }
        )
        .on(
            "transactionHash",
            txHash => {
                txId = txHash;
                $("#createOperatorTxCreated").html("Created Transaction: " + txHash);
                $("#createOperatorTxReceipt").html("");
                $("#logCreateOperatorEvent").html("");
                $("#logCreateOperatorSender").html("");
                $("#logCreateOperatorNewOperator").html("");
                $("#logCreateOperatorOwner").html("");
                $("#logCreateOperatorDepositWeis").html("");
            }
        )
        .on(
            "receipt", receipt =>{
                if (!receipt.status) {
                    console.error("Wrong status");
                    console.error(receipt);
                    $("#createOperatorTxReceipt").html("There was an error in the tx execution, status not 1");
                    $("#logCreateOperatorEvent").html("");
                    $("#logCreateOperatorSender").html("");
                    $("#logCreateOperatorNewOperator").html("");
                    $("#logCreateOperatorOwner").html("");
                    $("#logCreateOperatorDepositWeis").html("");

                } else if (receipt.logs.length == 0) {
                    console.error("Empty logs");
                    console.error(receipt);
                    $("#createOperatorTxReceipt").html("There was an error in the tx execution, missing expected event");
                    $("#logCreateOperatorEvent").html("");
                    $("#logCreateOperatorSender").html("");
                    $("#logCreateOperatorNewOperator").html("");
                    $("#logCreateOperatorOwner").html("");
                    $("#logCreateOperatorDepositWeis").html("");
                } else {
                    logIndex = 1 // `LogTollBoothOperatorCreated` will be the 2nd log.
                    $("#createOperatorTxReceipt").html("Transfer executed. Tx ID: " + txId);
                    $("#logCreateOperatorEvent").html("Event Name: " + receipt.logs[logIndex].event);
                    $("#logCreateOperatorSender").html("Sender: "
                        +receipt.logs[logIndex].args.sender);
                    $("#logCreateOperatorNewOperator").html("New Operator Contract: "+receipt.logs[logIndex].args.newOperator);
                    $("#logCreateOperatorOwner").html("New Operator Owner: "+receipt.logs[logIndex].args.owner);
                    $("#logCreateOperatorDepositWeis").html("Base Deposit: "+receipt.logs[logIndex].args.depositWeis);
                }
            }       
        )
    } catch (e){
        let errorString = e.toString();
        if (errorString.includes("invalid address")){
            errorString = "Tx not created. Please check input addresses.";
        }
        $("#createOperatorTxCreated").html(errorString);
        $("#createOperatorTxReceipt").html("");
        $("#logCreateOperatorEvent").html("");
        $("#logCreateOperatorSender").html("");
        $("#logCreateOperatorNewOperator").html("");
        $("#logCreateOperatorOwner").html("");
        $("#logCreateOperatorDepositWeis").html("");
        console.error(e);
    }
};

const checkVehTypeAction = async function() {
    try{
        const vehAddr = $("input[list='vehAddr']").val();
        // let deployed = await Regulator.deployed();
        const vehType = await deployed.getVehicleType.call(vehAddr);
        $("#registeredVehType").html("Registered Vehicle Type: " + vehType.toString(10));
    } catch (e) {
        $("#registeredVehType").html(e.toString());
        console.error(e);
    }
};


window.addEventListener('load', async function() {
    
    let accountsList = await web3.eth.getAccounts();
    accountsList.push("0x0000000000000000000000000000000000000000"); // for ease of testing with 0x0 address.

    deployed = await Regulator.deployed();
    regulatorOwner = await deployed.getOwner.call();

    const pastEvents = await deployed.getPastEvents("LogTollBoothOperatorCreated",
        { fromBlock:0, toBlock:'latest' });

    initialOperatorAddr = pastEvents[pastEvents.length-1].args.newOperator

    if (accountsList.length == 0) {
        throw new Error("No account with which to transact");
    }

    await web3.eth.net.getId();
    $('#regAddr').html(deployed.address);
    $('#regOwner').html(regulatorOwner);

    console.log(initialOperatorAddr);

    await getCurrentOperator(initialOperatorAddr);

    await Promise.all([
        populator("vehAddr", accountsList),
        // populator("vehAddrToCheck",accountsList),
        populator("oprAddr", accountsList),
        populator("tbAddr",accountsList),

        populator("indVehAddr",accountsList),
        populator("entryBoothAddr",accountsList),
        populator("exitTollBooth",accountsList),
        populator("rpEntryBooth",accountsList),
        populator("rpExitBooth",accountsList),
        // populator("tbAddr",accountsList),
        // populator("tbAddr",accountsList),
        // populator("tbAddr",accountsList),
        // populator("tbAddr",accountsList),
        // populator("tbAddr",accountsList),
        populator("entryB",accountsList),
        populator("exitB",accountsList),

        $("#SetVehType").click(setVehTypeAction),
        $("#CheckVehType").click(checkVehTypeAction),
        $("#CreateOperator").click(createOperatorAction),
        $("#SpecifyOperatorAddr").click(specifyOperatorAddrAction),
        $("#AddTollBooth").click(addTollBoothAction),
        $("#UpdateDeposit").click(updateDepositAction),
        $("#CheckMultiplier").click(checkMultiplierAction),
        $("#UpdateMultiplier").click(updateMultiplierAction),

        $("#CheckTollBooth").click(checkTollBoothAction),
        $("#CheckBalance").click(checkBalanceAction),
        $("#CheckMinDeposit").click(checkMinDepositAction),
        $("#RoadEntered").click(roadEnteredAction),
        $("#PauseOperator").click(pauseOperatorAction),
        $("#UnpauseOperator").click(unpauseOperatorAction),
        $("#GetEntryExitHistory").click(getEntryExitHistoryAction),
        $("#ReportExit").click(reportExitAction),
        $("#PendingPaymentsCount").click(pendingPaymentsCount),
        $("#CheckRoutePRice").click(checkRoutePriceAction),
        $("#UpdateRoutePrice").click(updateRoutePriceAction),
        // $("#GetEntryExitHistory").click(getEntryExitHistoryAction),
        // $("#GetEntryExitHistory").click(getEntryExitHistoryAction),
        // $("#GetEntryExitHistory").click(getEntryExitHistoryAction),
        // $("#GetEntryExitHistory").click(getEntryExitHistoryAction),
    ]).catch(console.error);
});

let populator = function(elId, list){
    let selector = this.document.getElementById(elId);

    for(let i = 0; i < list.length; i++) {
        let el = document.createElement("option");
        el.textContent = list[i];
        el.value = list[i];
        selector.appendChild(el);

    }
}
