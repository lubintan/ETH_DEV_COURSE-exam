const Web3 = require("web3");
const Promise = require("bluebird");
const truffleContract = require("truffle-contract");
const $ = require("jquery");
const regulatorJson = require("../../build/contracts/Regulator.json");
const tbOperatorJson = require("../../build/contracts/TollBoothOperator.json");
const toBN = Web3.utils.toBN;

let regulatorOwner, deployed, tbOperatorContract;
let tbOperatorOwner = null;
let currentDeposit = null;

window.web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545')); 

// Uncomment this section below to enable web3 injection.
/* 
if (typeof web3 !== 'undefined') {
    window.web3 = new Web3(web3.currentProvider);
    window.ethereum.enable();
    } 
// Note that the deployed regulator and toll booth operator owners' accounts will need to be imported
// into Metamask or other wallet in other to be used. 
*/ 


const Regulator = truffleContract(regulatorJson);
Regulator.setProvider(web3.currentProvider);
const TollBoothOperator = truffleContract(tbOperatorJson);
TollBoothOperator.setProvider(web3.currentProvider);

const roadEntryTableBuilder = function(logs){
    try{
        $('#entryTableTitle').empty();
        $('#entryTableTitle').append('<h2 class="font-weight-bold">Entry History</h2><br>');
        $("#entryTable").empty();
        
        //  header row
        let header = $("<thead>");
        let headerRow = $("<tr>");
        let labels ="";

        labels += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + 'Block No.' + '</td>';
        labels += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + 'Vehicle' + '</td>';
        labels += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + 'Entry Booth' + '</td>';
        labels += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + 'Exit Secret Hashed' + '</td>';
        labels += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + 'Multiplier' + '</td>';
        labels += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + 'Deposited Weis' + '</td>';


        header.append(headerRow.append(labels));
        $("#entryTable").append(header);

        for(i=0; i < logs.length; i++){
        
            let newRow = $("<tr>");
            let cols = "";

            
            cols += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + logs[i].blockNumber + '</td>';
            cols += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + logs[i].args.vehicle + '</td>';
            cols += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + logs[i].args.entryBooth + '</td>';
            cols += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + logs[i].args.exitSecretHashed + '</td>';
            cols += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + logs[i].args.multiplier.toString(10) + '</td>';
            cols += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + logs[i].args.depositedWeis.toString(10) + '</td>';

            newRow.append(cols);
            $("#entryTable").append(newRow);
        }
    }catch(e){
        $("#entryTable").html(e.toString());
    }    
}

const exitTollBoothTableBuilder = async function (logs, thisExitBoothAddr) {
    try{
        $("#reExitTable").empty();
        $('#reExitTableTitle').empty();
        $('#reExitTableTitle').append('<h2 class="font-weight-bold">Exit History At This Booth</h2><br>');
        $("#rePendingTable").empty();
        $('#rePendingTableTitle').empty();
        $('#rePendingTableTitle').append('<h2 class="font-weight-bold">Pending Payments At This Booth</h2><br>');

        //  exit table header row
        let header = $("<thead>");
        let headerRow = $("<tr>");
        let labels ="";
        labels +=  '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + 'Block No.' + '</td>';
        labels +=  '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + 'Exit Booth' + '</td>';
        labels += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + 'Exit Secret Hashed' + '</td>';
        labels += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + 'Final Fee Weis' + '</td>';
        labels += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + 'Refund Weis' + '</td>';


        header.append(headerRow.append(labels));
        $("#reExitTable").append(header);

        //  pending table header row
        let headerP = $("<thead>");
        let headerRowP = $("<tr>");
        let labelsP ="";
        labelsP += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + 'Block No.' + '</td>';
        labelsP += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + 'Exit Secret Hashed' + '</td>';
        labelsP += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + 'Entry Booth' + '</td>';
        labelsP +=  '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + 'Exit Booth' + '</td>';

        headerP.append(headerRowP.append(labelsP));
        $("#rePendingTable").append(headerP);

        for(i=0; i < logs.length; i++){

            const exitHash = logs[i].args.exitSecretHashed;
            const exitEvents = await tbOperatorContract.getPastEvents("LogRoadExited",
                { filter: {exitSecretHashed: exitHash, exitBooth: thisExitBoothAddr}, fromBlock:0, toBlock:'latest' });
            const pendingEvents = await tbOperatorContract.getPastEvents("LogPendingPayment",
                { filter: {exitSecretHashed: exitHash, exitBooth: thisExitBoothAddr }, fromBlock:0, toBlock:'latest' });

            if (exitEvents.length > 0){

                let newRow = $("<tr>");
                let cols = "";
                cols += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + exitEvents[0].blockNumber + '</td>';
                cols += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + exitEvents[0].args.exitBooth + '</td>';
                cols += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + exitEvents[0].args.exitSecretHashed + '</td>';
                cols += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + exitEvents[0].args.finalFee.toString(10) + '</td>';
                cols += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + exitEvents[0].args.refundWeis.toString(10) + '</td>';
        
                newRow.append(cols);
                $("#reExitTable").append(newRow);
            }
            
            if (pendingEvents.length > 0 ){

                let newRowP = $("<tr>");
                let colsP = "";
                colsP += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + pendingEvents[0].blockNumber + '</td>';
                colsP += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + pendingEvents[0].args.exitSecretHashed + '</td>';
                colsP += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + pendingEvents[0].args.entryBooth + '</td>';
                colsP += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + pendingEvents[0].args.exitBooth + '</td>';
            
                newRowP.append(colsP);
                $("#rePendingTable").append(newRowP);
            }
        }
    }catch(e){
        $("#reExitTable").html(e.toString());
    }
}

const roadExitTableBuilder = async function(logs){
    try{
        $("#exitTable").empty();
        $('#exitTableTitle').empty();
        $('#exitTableTitle').append('<h2 class="font-weight-bold">Exit History</h2><br>');
        $("#pendingTable").empty();
        $('#pendingTableTitle').empty();
        $('#pendingTableTitle').append('<h2 class="font-weight-bold">Pending Payments</h2><br>');

        //  exit table header row
        let header = $("<thead>");
        let headerRow = $("<tr>");
        let labels ="";
        labels +=  '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + 'Block No.' + '</td>';
        labels +=  '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + 'Exit Booth' + '</td>';
        labels += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + 'Exit Secret Hashed' + '</td>';
        labels += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + 'Final Fee Weis' + '</td>';
        labels += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + 'Refund Weis' + '</td>';


        header.append(headerRow.append(labels));
        $("#exitTable").append(header);

        //  pending table header row
        let headerP = $("<thead>");
        let headerRowP = $("<tr>");
        let labelsP ="";
        labelsP += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + 'Block No.' + '</td>';
        labelsP += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + 'Exit Secret Hashed' + '</td>';
        labelsP += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + 'Entry Booth' + '</td>';
        labelsP +=  '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + 'Exit Booth' + '</td>';

        headerP.append(headerRowP.append(labelsP));
        $("#pendingTable").append(headerP);

        for(i=0; i < logs.length; i++){

            const exitHash = logs[i].args.exitSecretHashed;
            const exitEvents = await tbOperatorContract.getPastEvents("LogRoadExited",
                { filter: {exitSecretHashed: exitHash }, fromBlock:0, toBlock:'latest' });
            const pendingEvents = await tbOperatorContract.getPastEvents("LogPendingPayment",
                { filter: {exitSecretHashed: exitHash }, fromBlock:0, toBlock:'latest' });

            if (exitEvents.length > 0){

                let newRow = $("<tr>");
                let cols = "";
                cols += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + exitEvents[0].blockNumber + '</td>';
                cols += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + exitEvents[0].args.exitBooth + '</td>';
                cols += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + exitEvents[0].args.exitSecretHashed + '</td>';
                cols += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + exitEvents[0].args.finalFee.toString(10) + '</td>';
                cols += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + exitEvents[0].args.refundWeis.toString(10) + '</td>';
        
                newRow.append(cols);
                $("#exitTable").append(newRow);
            }
            
            if (pendingEvents.length > 0 ){

                let newRowP = $("<tr>");
                let colsP = "";
                colsP += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + pendingEvents[0].blockNumber + '</td>';
                colsP += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + pendingEvents[0].args.exitSecretHashed + '</td>';
                colsP += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + pendingEvents[0].args.entryBooth + '</td>';
                colsP += '<td style="word-wrap: break-word;min-width: 20px;max-width: 120px;">' + pendingEvents[0].args.exitBooth + '</td>';
            
                newRowP.append(colsP);
                $("#pendingTable").append(newRowP);
            }
        }
    }catch(e){
        $("#exitTable").html(e.toString());
    }
}



const getEntryExitHistoryAction = async function() {
    if(tbOperatorOwner == null){
        $("#entryTable").html("Please specify a valid Toll Booth Operator Contract Address first.");
    }else{
        try{
            const vehAddr = $("input[list='indVehAddr']").val();
            const pastEvents = await tbOperatorContract.getPastEvents("LogRoadEntered",
            { filter: {vehicle: vehAddr }, fromBlock:0, toBlock:'latest' });

            if (pastEvents.length == 0){
                $("#entryTable").html("No records found.");
            }else{
                roadEntryTableBuilder(pastEvents);
                await roadExitTableBuilder(pastEvents);
            }

        } catch (e){
            $("#entryTable").html(e.toString());
        }
    }
};

const pendingPaymentsCount = async function() {
    if(tbOperatorOwner == null){
        $("#numPendingPayments").html("Please specify a valid Toll Booth Operator Contract Address first.");
    }else{
        try{
            const entryB = $("input[list='entryB']").val();
            const exitB = $("input[list='exitB']").val();
        
            const res = await tbOperatorContract.getPendingPaymentCount.call(entryB, exitB);

            $("#numPendingPayments").html("Number Of Pending Payments For This Route: " + res.toString(10));
        } catch (e) {
            $("#numPendingPayments").html(e.toString());
            console.error(e);
        }
    }
}

const reportExitAction = async function() {
    if(tbOperatorOwner == null){
        $("#reportExitTxCreated").html("Please specify a valid Toll Booth Operator Contract Address first.");
    }else{
        try{
            const gas = 300000; 
            let txId;
            let exitHash = 0;
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
                    $("#reExitTableTitle").html("");
                    $("#reExitTable").html("");
                    $("#rePendingTableTitle").html("");
                    $("#rePendingTable").html("");
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
                        $("#reExitTableTitle").html("");
                        $("#reExitTable").html("");
                        $("#rePendingTableTitle").html("");
                        $("#rePendingTable").html("");

                    } else if (receipt.logs.length == 0) {
                        console.error("Empty logs");
                        console.error(receipt);
                        $("#reportExitTxReceipt").html("There was an error in the tx execution, missing expected event");
                        $("#logReportExitEvent").html("");
                        $("#logReportExitExitBooth").html("");
                        $("#logReportExitExitSecretHashed").html("");
                        $("#logReportExitFinalFee").html("");
                        $("#logReportExitRefundWeis").html("");
                        $("#reExitTableTitle").html("");
                        $("#reExitTable").html("");
                        $("#rePendingTableTitle").html("");
                        $("#rePendingTable").html("");
                    } else {
                        $("#reportExitTxReceipt").html("Transfer executed. Tx ID: " + txId);
                        eventName = receipt.logs[0].event;
                        $("#logReportExitEvent").html("Event Name: " + eventName);
                        if (eventName == 'LogRoadExited'){
                            $("#logReportExitExitBooth").html("Exit Booth: " + receipt.logs[0].args.exitBooth);
                            $("#logReportExitExitSecretHashed").html("Exit Secret Hashed: " + receipt.logs[0].args.exitSecretHashed);
                            $("#logReportExitFinalFee").html("Final Fee: " + receipt.logs[0].args.finalFee);
                            $("#logReportExitRefundWeis").html("Refund Weis: " + receipt.logs[0].args.refundWeis);
                            exithash = receipt.logs[0].args.exitSecretHashed;
                        } else if(eventName == 'LogPendingPayment'){
                            $("#logReportExitExitBooth").html("Exit Booth: " + receipt.logs[0].args.exitBooth);
                            $("#logReportExitExitSecretHashed").html("Exit Secret Hashed: " + receipt.logs[0].args.exitSecretHashed);
                            $("#logReportExitFinalFee").html("Entry Booth: " + receipt.logs[0].args.entryBooth);
                            $("#logReportExitRefundWeis").html("");
                            exithash = receipt.logs[0].args.exitSecretHashed;
                        }else{
                            $("#logReportExitExitBooth").html("");
                            $("#logReportExitExitSecretHashed").html("");
                            $("#logReportExitFinalFee").html("");
                            $("#logReportExitRefundWeis").html("");
                            $("#reExitTableTitle").html("");
                            $("#reExitTable").html("");
                            $("#rePendingTableTitle").html("");
                            $("#rePendingTable").html("");
                        }
                    }
                }       
            )


            if (exithash != 0){
                const thisVehHistory = await tbOperatorContract.getPastEvents("LogRoadEntered",
                { filter: {exitSecretHashed: exithash }, fromBlock:0, toBlock:'latest' });
                const thisVehAddr = thisVehHistory[0].args.vehicle;
                const thisVehLogs = await tbOperatorContract.getPastEvents("LogRoadEntered",
                { filter: {vehicle: thisVehAddr }, fromBlock:0, toBlock:'latest' });
                await exitTollBoothTableBuilder(thisVehLogs, exitTollBooth);
            }
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
            $("#reExitTableTitle").html("");
            $("#reExitTable").html("");
            $("#rePendingTableTitle").html("");
            $("#rePendingTable").html("");
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

    await getCurrentOperator(initialOperatorAddr);

    await Promise.all([
        populator("vehAddr", accountsList),
        populator("oprAddr", accountsList),
        populator("tbAddr",accountsList),

        populator("indVehAddr",accountsList),
        populator("entryBoothAddr",accountsList),
        populator("exitTollBooth",accountsList),
        populator("rpEntryBooth",accountsList),
        populator("rpExitBooth",accountsList),
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
    ]).catch(console.error);
});

let populator = function(elId, list){
    try{
        let selector = this.document.getElementById(elId);

        for(let i = 0; i < list.length; i++) {
            let el = document.createElement("option");
            el.textContent = list[i];
            el.value = list[i];
            selector.appendChild(el);
        }
    }catch(e) {
        // do nothing.
    }
}
