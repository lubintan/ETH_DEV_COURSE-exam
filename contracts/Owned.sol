pragma solidity ^0.5.0;

import './interfaces/OwnedI.sol';

contract Owned is OwnedI {

    address private contractOwner;

    constructor ()
        public
    {
        contractOwner = msg.sender;
    }

    function setOwner(address newOwner)
        public
        returns(bool success)
    {
        address prevOwner = contractOwner;

        require (msg.sender == prevOwner, "This action may only be performed by the current contract contractOwner.");
        require(newOwner != prevOwner, "Caller has already been set as contractOwner.");
        require(newOwner != address(0), "Address 0x0 not allowed.");

        contractOwner = newOwner;

        emit LogOwnerSet(msg.sender, newOwner);

        success = true;
    }

    function getOwner()
        view
        public
        returns (address owner)
    {
        owner = contractOwner;
    }

    modifier fromOwner()
    {
        require (msg.sender == contractOwner, "This action may only be performed by the current contract contractOwner.");
        _;
    }
}
