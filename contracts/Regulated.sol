pragma solidity ^0.5.0;

import './interfaces/RegulatedI.sol';

contract Regulated is RegulatedI {

    address private thisRegulator;

    constructor(address newRegulator)
        internal
    {
        require(newRegulator != address(0), "Address 0x0 not allowed.");
        thisRegulator = newRegulator;

        emit LogRegulatorSet(address(0), newRegulator);
    }

    function setRegulator(address newRegulator)
        public
        returns(bool success)
    {
        address currentRegulator = thisRegulator;

        require(msg.sender == currentRegulator, "Only current thisRegulator can call this function.");
        require(newRegulator != address(0), "Address 0x0 not allowed.");
        require(newRegulator != currentRegulator, "You are already the thisRegulator.");

        thisRegulator = newRegulator;

        emit LogRegulatorSet(currentRegulator, newRegulator);

        success = true;
    }

    function getRegulator()
        view
        public
        returns(RegulatorI regulator)
    {
        regulator = RegulatorI(thisRegulator);
    }
  
}
