pragma solidity ^0.5.0;

import './Owned.sol';
import './interfaces/PausableI.sol';

contract Pausable is Owned, PausableI {

    bool private paused;

    constructor (bool newState)
        public
    {
        paused = newState;
        emit LogPausedSet(msg.sender, newState);
    }

    function setPaused(bool newState) 
        public
        fromOwner
        returns(bool success)
    {
        require(paused != newState, "State passed is no different from the current.");
        paused = newState;
        emit LogPausedSet(msg.sender, newState);

        success = true;
    }

    function isPaused() 
        view
        public
        returns (bool isIndeed) 
    {
        isIndeed = paused;
    }

    modifier whenPaused()
    {
        require(paused, "Contract must be in the paused state.");
        _;
    }

    modifier whenNotPaused()
    {
        require(!paused, "Contract must not be in the paused state.");
        _;
    }
}
