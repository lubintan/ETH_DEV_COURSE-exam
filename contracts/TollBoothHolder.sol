pragma solidity ^0.5.0;

import './Owned.sol';
import './interfaces/TollBoothHolderI.sol';

contract TollBoothHolder is Owned, TollBoothHolderI {

    mapping (address =>  bool) private tollBoothMap;

    constructor() public {}

    function addTollBooth(address tollBooth)
        public
        fromOwner
        returns(bool success)
    {
        require(!tollBoothMap[tollBooth], "Toll booth already added.");
        require(tollBooth != address(0), "Address 0x0 not allowed.");

        tollBoothMap[tollBooth] = true;

        emit LogTollBoothAdded(msg.sender, tollBooth);

        success = true;
    }

    function isTollBooth(address tollBooth)
        view
        public
        returns(bool isIndeed)
    {
        isIndeed = tollBoothMap[tollBooth];
    }

    function removeTollBooth(address tollBooth)
        public
        fromOwner
        returns(bool success)
    {
        require(tollBoothMap[tollBooth], "Toll booth not registered.");
        require(tollBooth != address(0), "Address 0x0 not allowed.");

        tollBoothMap[tollBooth] = false;

        emit LogTollBoothRemoved(msg.sender, tollBooth);

        success = true;
    }
}
