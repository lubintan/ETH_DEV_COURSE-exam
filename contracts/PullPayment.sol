pragma solidity ^0.5.0;

import './interfaces/PullPaymentA.sol';
import './SafeMath.sol';

contract PullPayment is PullPaymentA {

    using SafeMath for uint;

    mapping (address => uint) internal balances;

    constructor() public {}

    function asyncPayTo(address whom, uint amount)
        internal
    {
        (bool success, ) = whom.call.value(amount)("");
        require(success, "Fund transfer failed.");
    }

    function withdrawPayment()
        public
        returns(bool success)
    {
        uint amount = balances[msg.sender];
        require(amount > 0, "Nothing to withdraw.");

        balances[msg.sender] = 0;
        emit LogPaymentWithdrawn(msg.sender, amount);

        asyncPayTo(msg.sender, amount);

        success = true;
    }

    function getPayment(address whose)
        view
        public
        returns(uint weis)
    {
        weis = balances[whose];
    }

}
