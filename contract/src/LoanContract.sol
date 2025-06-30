// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract LoanContract {
    uint256 public number; // A simple number variable for demonstration purposes

    // Mapping to store balances of users
    mapping(address => uint256) public balances;

    // Mapping to store loans for each user, indexed by loan ID
    mapping(address => mapping(uint256 => LoanDetails)) public loans;

    // Mapping to store liquidity receipts for each user, indexed by liquidity ID
    mapping(address => mapping(uint256 => LiquidityReceipt)) public liquidityReceipts;

    // Mapping to store total liquidity balances for each user
    mapping(address => uint256) public liquidityBalances;

    // Mapping to store the credit limit for each user
    mapping(address => uint256) public creditLimits;

    // Struct to represent a loan
    struct Loan {
        uint256 amount; // Loan amount
        uint256 apr; // Annual Percentage Rate
        uint256 lockTime; // Time in seconds the funds are locked
        uint256 startTime; // Timestamp when the loan starts
    }

    // Struct to represent a liquidity receipt
    struct LiquidityReceipt {
        uint256 amount; // Amount of liquidity deposited
        uint256 lockTime; // Time in seconds the liquidity is locked
        uint256 apy; // Annual Percentage Yield
        uint256 startTime; // Timestamp when the liquidity was deposited
        bool isEmpty; // Flag to indicate if the liquidity is empty
    }

    // Struct to represent a loan installment
    struct LoanInstallment {
        uint256 amount; // Amount of the installment
        uint256 dueDate; // Due date for the installment
        bool isPaid; // Flag to indicate if the installment is paid
        bool isLate; // Flag to indicate if the installment was paid late
    }

    // Struct to represent loan details
    struct LoanDetails {
        uint256 totalAmount; // Total amount of the loan including commission
        uint256 commission; // Commission charged for the loan
        LoanInstallment[] installments; // Array of installments for the loan
        address[] liquidityProviders; // Array of liquidity providers for the loan
        uint256[] liquidityIds; // Array of liquidity IDs used for the loan
    }

    IERC20 public token; // ERC20 token used for transactions

    uint256 public nextLiquidityId; // Counter for generating unique liquidity IDs
    uint256 public nextLoanId; // Counter for generating unique loan IDs

    // Maximum credit limit per user (e.g., 500 USD in token units)
    uint256 public constant MAX_CREDIT_LIMIT = 500 * 10**5; // USDC has 5 decimals

    // USDC token address (replace with actual address on your network)
    address public constant USDC_ADDRESS = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48; // Example: Ethereum Mainnet

    constructor() {
        token = IERC20(USDC_ADDRESS); // Initialize the contract with USDC token
    }

    // Function to set a number (for demonstration purposes)
    function setNumber(uint256 newNumber) public {
        number = newNumber;
    }

    // Function to increment the number (for demonstration purposes)
    function increment() public {
        number++;
    }

    // Function to deposit tokens into the contract
    function deposit(uint256 amount) public {
        if (amount <= 0) {
            revert("Deposit amount must be greater than zero");
        }
        if (!token.transferFrom(msg.sender, address(this), amount)) {
            revert("Token transfer failed");
        }
        balances[msg.sender] += amount;
    }

    // Function to get the balance of a user
    function getBalance(address user) public view returns (uint256) {
        return balances[user];
    }

    // Function to deposit liquidity into the contract
    function depositLiquidity(
        uint256 amount,
        uint256 lockTime,
        uint256 apy
    ) public {
        if (amount <= 0) {
            revert("Deposit amount must be greater than zero");
        }
        if (!token.transferFrom(msg.sender, address(this), amount)) {
            revert("Token transfer failed");
        }

        liquidityReceipts[msg.sender][nextLiquidityId] = LiquidityReceipt({
            amount: amount,
            lockTime: lockTime,
            apy: apy,
            startTime: block.timestamp,
            isEmpty: false
        });

        nextLiquidityId++;
    }

    // Function to set the credit limit for a user
    function setCreditLimit(address user, uint256 limit) public {
        if (limit > MAX_CREDIT_LIMIT) {
            revert("Credit limit exceeds maximum allowed");
        }
        creditLimits[user] = limit;
    }

    // Function to check if a user has overdue loans
    function hasOverdueLoans(address user) public view returns (bool) {
        for (uint256 i = 0; i < nextLoanId; i++) {
            LoanDetails storage loan = loans[user][i];
            if (loan.totalAmount > 0) {
                for (uint256 j = 0; j < loan.installments.length; j++) {
                    if (!loan.installments[j].isPaid && block.timestamp > loan.installments[j].dueDate) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    // Modified requestLoan function to enforce credit limit and overdue loan check
    function requestLoan(
        uint256[] memory amounts,
        uint256[] memory liquidityIds,
        uint256 installments
    ) public {
        if (amounts.length != liquidityIds.length) {
            revert("Amounts and liquidity IDs must match");
        }

        if (hasOverdueLoans(msg.sender)) {
            revert("User has overdue loans");
        }

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            LiquidityReceipt storage receipt = liquidityReceipts[msg.sender][
                liquidityIds[i]
            ];
            if (receipt.isEmpty || receipt.amount < amounts[i]) {
                revert("Insufficient liquidity");
            }
            receipt.amount -= amounts[i];
            if (receipt.amount == 0) {
                receipt.isEmpty = true;
            }
            totalAmount += amounts[i];
        }

        uint256 commission = (totalAmount * 5) / 1000; // 0.5% commission
        totalAmount += commission;

        if (creditLimits[msg.sender] + totalAmount > MAX_CREDIT_LIMIT) {
            revert("Credit limit exceeded");
        }

        creditLimits[msg.sender] += totalAmount;

        LoanDetails storage loan = loans[msg.sender][nextLoanId];
        loan.totalAmount = totalAmount;
        loan.commission = commission;
        loan.liquidityProviders.push(msg.sender);
        loan.liquidityIds = liquidityIds;

        uint256 installmentAmount = totalAmount / installments;
        for (uint256 i = 0; i < installments; i++) {
            loan.installments.push(
                LoanInstallment({
                    amount: installmentAmount,
                    dueDate: block.timestamp + (30 days * (i + 1)),
                    isPaid: false,
                    isLate: false
                })
            );
        }

        nextLoanId++;
    }

    // Function to pay a loan
    function payLoan(uint256 loanId, uint256 amount) public {
        LoanDetails storage loan = loans[msg.sender][loanId];
        if (loan.totalAmount == 0) {
            revert("Loan does not exist");
        }

        uint256 remainingAmount = amount;
        for (uint256 i = 0; i < loan.installments.length; i++) {
            LoanInstallment storage installment = loan.installments[i];
            if (!installment.isPaid && remainingAmount >= installment.amount) {
                remainingAmount -= installment.amount;
                installment.isPaid = true;
                if (block.timestamp > installment.dueDate) {
                    installment.isLate = true;
                }
            }
        }

        if (remainingAmount > 0) {
            revert("Excess payment amount");
        }

        loan.totalAmount -= amount;
        if (loan.totalAmount == 0) {
            delete loans[msg.sender][loanId];
        }
    }

    // Function to pay debt for a loan
    function payDebt(uint256 loanId, uint256 amount) public {
        LoanDetails storage loan = loans[msg.sender][loanId];
        if (loan.totalAmount == 0) {
            revert("Loan does not exist");
        }

        uint256 interest = (loan.totalAmount * 80) / 100; // 80% annual interest
        loan.totalAmount += interest;

        if (amount > loan.totalAmount) {
            revert("Excess payment amount");
        }

        loan.totalAmount -= amount;
        if (loan.totalAmount == 0) {
            delete loans[msg.sender][loanId];
        }
    }

    // Function to withdraw liquidity
    function withdraw(uint256 liquidityId) public {
        LiquidityReceipt storage receipt = liquidityReceipts[msg.sender][
            liquidityId
        ];
        if (block.timestamp < receipt.startTime + receipt.lockTime) {
            revert("Liquidity is still locked");
        }
        if (receipt.isEmpty) {
            revert("Liquidity is empty");
        }

        uint256 amount = receipt.amount;
        receipt.amount = 0;
        receipt.isEmpty = true;

        if (!token.transfer(msg.sender, amount)) {
            revert("Token transfer failed");
        }
    }
}
