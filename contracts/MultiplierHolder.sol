pragma solidity ^0.5.0;

import './Owned.sol';
import './interfaces/MultiplierHolderI.sol';

contract MultiplierHolder is Owned, MultiplierHolderI {

    mapping(uint => uint) private multiplierMap;

    constructor () internal {}

    function setMultiplier(uint vehicleType, uint multiplier)
        public
        fromOwner
        returns(bool success)
    {
        require(vehicleType > 0, "Unrecognized vehicle type.");
        require(multiplierMap[vehicleType] != multiplier, "The same multiplier is already set to the vehicle type.");

        multiplierMap[vehicleType] = multiplier;

        emit LogMultiplierSet(msg.sender, vehicleType, multiplier);

        success = true;
    }

    function getMultiplier(uint vehicleType)
        view
        public
        returns(uint multiplier)
    {
        multiplier = multiplierMap[vehicleType];
    }
}
