pragma solidity ^0.5.0;

import './Owned.sol';
import './interfaces/DepositHolderI.sol';

contract DepositHolder is Owned, DepositHolderI {

    uint private deposit;

    constructor (uint initialDeposit) 
        internal
    {
        require(initialDeposit > 0, "Cannot set deposit to nothing.");
        deposit = initialDeposit;
    }

    function setDeposit(uint depositWeis)
        public
        fromOwner
        returns(bool success)
    {
        require(depositWeis > 0, "Cannot set deposit to nothing.");
        require(deposit != depositWeis, "Deposit already set to desired amount.");

        deposit = depositWeis;

        emit LogDepositSet(msg.sender, depositWeis);

        success = true;
    }

    function getDeposit()
        view
        public
        returns(uint weis)
    {
        weis = deposit;
    }

}
