pragma solidity ^0.5.0;

import "./interfaces/RegulatorI.sol";
import "./interfaces/TollBoothOperatorI.sol";
import "./Owned.sol";
import "./TollBoothOperator.sol";

contract Regulator is Owned, RegulatorI{
    mapping (address => uint) private vehicleMap;
    mapping (address => bool) private tollBoothOperatorMap;

    constructor() public {}

    function setVehicleType(address vehicle, uint vehicleType)
        public
        fromOwner
        returns(bool success)
    {
        require(vehicleMap[vehicle] != vehicleType, "No change of state.");
        require(vehicle != address(0), "Address 0x0 not allowed.");

        vehicleMap[vehicle] = vehicleType;

        emit LogVehicleTypeSet(msg.sender, vehicle, vehicleType);

        success =true;
    }

    function getVehicleType(address vehicle)
        view
        public
        returns(uint vehicleType)
    {
        vehicleType = vehicleMap[vehicle];
    }

    function createNewOperator(address owner, uint deposit)
        public
        fromOwner
        returns(TollBoothOperatorI newOperator)
    {
        require(!tollBoothOperatorMap[owner], "Operator exists.");

        TollBoothOperator newTollBoothOperator = new TollBoothOperator(true, deposit, address(this));

        require(newTollBoothOperator.setOwner(owner), "Unable to set ownership to intended owner.");

        tollBoothOperatorMap[address(newTollBoothOperator)] = true;

        emit LogTollBoothOperatorCreated(msg.sender, address(newTollBoothOperator), owner, deposit);

        newOperator = TollBoothOperatorI(address(newTollBoothOperator));
    }

    function removeOperator(address operator)
        public
        fromOwner
        returns(bool success)
    {
        require(tollBoothOperatorMap[operator], "Unrecognized operator.");

        tollBoothOperatorMap[operator] = false;

        emit LogTollBoothOperatorRemoved(msg.sender, operator);

        success = true;
    }

    function isOperator(address operator)
        view
        public
        returns(bool indeed)
    {
        indeed = tollBoothOperatorMap[operator];
    }

}