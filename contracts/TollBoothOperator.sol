pragma solidity ^0.5.0;

import './interfaces/TollBoothOperatorI.sol';
import './Pausable.sol';
import './DepositHolder.sol';
// import './TollBoothHolder.sol';
import './MultiplierHolder.sol';
import './RoutePriceHolder.sol';
import './Regulated.sol';
import './PullPayment.sol';

contract TollBoothOperator is   Owned, Pausable, DepositHolder, TollBoothHolder, MultiplierHolder,
                                RoutePriceHolder, Regulated, PullPayment, TollBoothOperatorI {

    using SafeMath for uint;

    struct VehEntryInfo
    {
        address vehicle;
        address entryBooth;
        uint multiplier;
        uint depositedWeis;
    }

    struct PendingPayments
    {
        uint length;
        uint head;
        bytes32[] pendingList;
    }

    mapping(bytes32 => VehEntryInfo) vehEntryMap;
    mapping(address => mapping(address => PendingPayments)) pendingPaymentsMap;

    constructor (bool paused, uint initialDeposit, address initialRegulator)
        public
        Pausable(paused)
        DepositHolder(initialDeposit)
        Regulated(initialRegulator)
    {}

    function() 
        external 
    {
        revert();
    }

    function hashSecret(bytes32 secret)
        view
        public
        returns(bytes32 hashed)
    {
        hashed = keccak256(abi.encodePacked(secret, address(this)));
    }

    function enterRoad(address entryBooth, bytes32 exitSecretHashed)
        public
        payable
        whenNotPaused
        returns (bool success)
    {
        uint vehicleType = getRegulator().getVehicleType(msg.sender);
        uint deposit = getDeposit();
        uint multiplier = getMultiplier(vehicleType);

        require(vehicleType > 0, "Vehicle is not registered.");
        require(multiplier > 0, "Vehicle not allowed ont his road system.");
        require(isTollBooth(entryBooth), "Toll booth is not registered.");
        require(msg.value >= (deposit.mul(multiplier)), "Not enough deposit sent.");
        require(vehEntryMap[exitSecretHashed].vehicle == address(0), "This hash has been used before.");

        vehEntryMap[exitSecretHashed].vehicle = msg.sender;
        vehEntryMap[exitSecretHashed].entryBooth = entryBooth;
        vehEntryMap[exitSecretHashed].multiplier = multiplier;
        vehEntryMap[exitSecretHashed].depositedWeis = msg.value;

        emit LogRoadEntered(msg.sender, entryBooth, exitSecretHashed, multiplier, deposit);

        success = true;
    }

    function getVehicleEntry(bytes32 exitSecretHashed)
        view
        public
        returns(
            address vehicle,
            address entryBooth,
            uint multiplier,
            uint depositedWeis)
    {
        vehicle = vehEntryMap[exitSecretHashed].vehicle;
        entryBooth = vehEntryMap[exitSecretHashed].entryBooth;
        multiplier = vehEntryMap[exitSecretHashed].multiplier;
        depositedWeis = vehEntryMap[exitSecretHashed].depositedWeis;
    }

    function reportExitRoad(bytes32 exitSecretClear)
        public
        whenNotPaused
        returns (uint status)
    {
        bytes32 exitSecretHashed = hashSecret(exitSecretClear);
        address entryBooth = vehEntryMap[exitSecretHashed].entryBooth;
        address vehicle = vehEntryMap[exitSecretHashed].vehicle;

        require(isTollBooth(msg.sender), "Sender is not a recognized toll booth.");
        require(msg.sender != entryBooth, "Entry and exit booth cannot be the same.");
        require(vehicle != address(0), "No exisitng matches for hashed secret.");
        require(entryBooth != address(0), "Secret has already been reported on exit.");

        uint fee = getRoutePrice(entryBooth, msg.sender).mul(vehEntryMap[exitSecretHashed].multiplier);

        uint paidDeposit = vehEntryMap[exitSecretHashed].depositedWeis;

        address owner = getOwner();

        if (fee == 0) {
            require(insert(entryBooth, msg.sender, exitSecretHashed), "Adding pending payment to queue failed.");
            emit LogPendingPayment(exitSecretHashed, entryBooth, msg.sender);
            status = 2;
        } else {
            if (fee >= paidDeposit){
                vehEntryMap[exitSecretHashed].depositedWeis = 0;
                owed[owner]  = owed[owner].add(paidDeposit);
            } else { // (fee < paidDeposit) {
                owed[vehicle] = owed[vehicle].add(paidDeposit.sub(fee));
                owed[owner]  = owed[owner].add(fee);
            }

            emit LogRoadExited(msg.sender, exitSecretHashed, fee, paidDeposit.sub(fee));
            status = 1;
        }

        vehEntryMap[exitSecretHashed].entryBooth = address(0);
        vehEntryMap[exitSecretHashed].multiplier = 0;
        vehEntryMap[exitSecretHashed].depositedWeis = 0;
    }

    function getPendingPaymentCount(address entryBooth, address exitBooth)
        view
        public
        returns (uint count)
    {
        count = pendingPaymentsMap[entryBooth][exitBooth].length;
    }

    function clearSomePendingPayments(address entryBooth, address exitBooth, uint count)
        public
        whenNotPaused
        returns (bool success)
    {
        uint pendingPaymentsCount = pendingPaymentsMap[entryBooth][exitBooth].length;
        uint baseRoutePrice = getRoutePrice(entryBooth, exitBooth);

        require(isTollBooth(entryBooth), "Entry booth is not registered.");
        require(isTollBooth(exitBooth), "Exit booth is not registered.");
        require(count <= pendingPaymentsCount, "Cannot clear more payments than are pending.");
        require(count > 0, "Please clear at least 1 pending payment.");
        require(baseRoutePrice > 0, "Please set the base route price for this route before clearing payments.");

        require(remove(entryBooth, exitBooth, count, baseRoutePrice), "Clearing pending payments failed.");
        pendingPaymentsMap[entryBooth][exitBooth].length = pendingPaymentsCount.sub(count);

        success = true;
    }

    function setRoutePrice(address entryBooth, address exitBooth, uint priceWeis)
        public
        returns(bool success)
    {
        require(RoutePriceHolder.setRoutePrice(entryBooth, exitBooth, priceWeis), "Could not set route price.");
        require(remove(entryBooth, exitBooth, 1, priceWeis), "Clearing 1 pending payment failed.");

        success = true;
    }

    function withdrawPayment()
        public
        whenNotPaused
        returns(bool success)
    {
        require(PullPayment.withdrawPayment(), "Payment withdrawal failed.");

        success = true;
    }

    // Methods for handling the Pending Payments Queue
    function insert(address enter, address exit, bytes32 exitSecretHashed)
        internal
        returns (bool success)
    {
        pendingPaymentsMap[enter][exit].pendingList.push(exitSecretHashed);
        pendingPaymentsMap[enter][exit].length = pendingPaymentsMap[enter][exit].length.add(1);

        success = true;
    }
    
    function remove(address enter, address exit, uint count, uint baseRoutePrice)
        internal
        returns (bool success)
    {
        uint currentHead = pendingPaymentsMap[enter][exit].head;

        for (uint i = 0; i < count; i++){
            bytes32 exitSecretHashed = pendingPaymentsMap[enter][exit].pendingList[currentHead+i];
            pendingPaymentsMap[enter][exit].pendingList[currentHead+i] = bytes32(0);

            uint fee = baseRoutePrice.mul(vehEntryMap[exitSecretHashed].multiplier);
            uint paidDeposit = vehEntryMap[exitSecretHashed].depositedWeis;
            address owner = getOwner();

            if (fee >= paidDeposit){
                vehEntryMap[exitSecretHashed].depositedWeis = 0;
                owed[owner] = owed[owner].add(paidDeposit);
            } else { // (fee < paidDeposit) {
                address vehicle = vehEntryMap[exitSecretHashed].vehicle;
                owed[vehicle] = owed[vehicle].add(paidDeposit.sub(fee));
                owed[owner] = owed[owner].add(fee);
            }

            emit LogRoadExited(exit, exitSecretHashed, fee, paidDeposit.sub(fee));

            vehEntryMap[exitSecretHashed].entryBooth = address(0);
            vehEntryMap[exitSecretHashed].multiplier = 0;
            vehEntryMap[exitSecretHashed].depositedWeis = 0;
        }

        pendingPaymentsMap[enter][exit].head = currentHead.add(count);
        // pendingPaymentsMap[enter][exit].length = pendingPaymentsMap[enter][exit].length.sub(count);

        success = true;
    }
    
    function resetHead(address enter, address exit)
        fromOwner
        public
        returns (bool success)
    {
        require(pendingPaymentsMap[enter][exit].length == 0, "Pending payments still exist.");
        pendingPaymentsMap[enter][exit].head = 0;

        success = true;
    }


    

}
