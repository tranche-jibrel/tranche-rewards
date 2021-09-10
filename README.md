# tranche-rewards

<img src="https://gblobscdn.gitbook.com/spaces%2F-MP969WsfbfQJJFgxp2K%2Favatar-1617981494187.png?alt=media" alt="Tranche Logo" width="100">

Tranche Rewards is a decentralized set of contracts to distribute rewards and to have a solvency incentive ratio for protocols about Tranche Finance.

Rewards can be distributed in 4 different ways:

1. Dividend Mode: sending an amount of reward tokens directly to tranche token (calculations has to be performed offchain)

2. Dividend Distribution Mode: via RewardsDistribution contract, like Dividend Mode, but using a contract to send tokens to tranche tokens distributed based on single market TVLs and distributing rewards to trache token holders in a single place

3. Staking Mode: via IncentiveRewardsFactory contract, deploying 1 staking contract for each existing tranche token and staking them in a dedicated staking contract. Rewards accrued based on the amount of staken tokens with a rate per second.

4. Unstaken Mode: via IncentiveController contract, all tranche token holders can be rewarded with a rate per second and based on the tranche token amount on the total tranche token supply.

All modes can be used, depending on the way you would like to distribute rewards or incentives.

Mode 1 is ready using tranche tokens directly.

Modes 2 and 3 are inside OldProjects folder.

Mode 4 is present inside contracts folder.

If needed, underlying prices for markets can be manually set, or read from chainlink price feeds.

Other info can be found here: https://docs.tranche.finance/tranchefinance/slice-token/slice-incentive-ratio-sir

## What is the model contracts work when distributing rewards based on markets TVLs

This Model can be present in all mode or not, can be set in a contract or move to the backend. Please refer to Model.sol inside Mocks folder for a pure implementation of this model, or Markets.sol for Staking Mode (described above), or MarketHelper.sol for IncentivesController and RewardsDistribution mode. 

Data: 

    totalTVL = total value locked (TVL) inside tranche A & B
    extProtRet = external protocol return
    trARet = tranche A return
    trATVL = tranche A TVL
    trBTVL = tranche B TVL
    balFactor = slice balance factor between tranche A & B (50% means the same amount of slice tokens per tranche when tranches have the same return) 
    dailySliceAmount = amount of slice tokens per day


1. tranche B Return:

    `(totalTVL * (1 + extProtRet) - trATVL * (1 + trARet) - trBTVL) / trBTVL = trancheBReturn`

2. difference between external protocol return and tranche B return:

    `extProtRet - trancheBReturn = DeltaAPY`

3. ratio between DeltaAPY and extProtRet:

    `DeltaAPY / extProtRet = DeltaAPYPercentage`

4. add balanceFactor to DeltaAPYPercentage:

    `DeltaAPYPercentage + balFactor = trBPercentage`

5. multiply trBPercentage by dailySliceAmount:

    `trBPercentage * dailySliceAmount = trBSliceRewards`

6. subtract trBSliceRewards to dailySliceAmount: 

    `dailySliceAmount - trBSliceRewards = trASliceRewards`

All in one formula:

    (((extProtRet-(totalTVL*(1+extProtRet)-trATVL*(1+trARet)-trBTVL)/trBTVL)/extProtRet)+balFactor)*dailySliceAmount

[(Back to top)](#tranche-rewards)

## Development

### Install Dependencies

```bash
npm i
```

### Compile project

```bash
truffle compile --all
```

### Run test

Ways to test contracts:

All tests (ganache required: npx ganache-cli --deterministic -l 12000000), gas reporter included:

    `truffle test`   

1 test only (ganache required: npx ganache-cli --deterministic -l 12000000), gas reporter included:

    `truffle test ./test/IncentiveRewards.test.js`   

Solidity Coverage (no ganache required):

    `truffle run coverage --network development --file="<filename>"`   

### Test Coverage

Every distribution mode requires different contract(s) to be deployed, that's why you can find 3 different files in migration and in test folders. The easiest way to test all contracts is to deploy 1 mode only per session and launch the related test file(s). Please refer to project you are interested into to have the correct migration and test files 

Tests on Incentive Controller contract is around 99%.

Tests on Market Helper contract is around 98%.

Tests on Price Helper contract is around 96%.

[(Back to top)](#tranche-rewards)

## Main contracts - Name, Size and Description

<table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Size (KiB)</th>
        <th>Description</th>
      </tr>
    </thead>
    <tbody>
        <tr>
            <td>IncentivesController</td>
            <td><code>21.28</code></td>
            <td>Contract for incentive rewards (implementation), distributing rewards on Tranche tokens holders</td>
        </tr>
        <tr>
            <td>IncentivesControllerStorage</td>
            <td><code>1.67</code></td>
            <td>Contract for incentive rewards distribution (storage)</td>
        </tr>
        <tr>
            <td>MarketsHelper</td>
            <td><code>3.96</code></td>
            <td>Contract for modelling markets</td>
        </tr>
        <tr>
            <td>PriceHelper</td>
            <td><code>3.37</code></td>
            <td>Contract to interact with Chainlink price feeds (implementation)</td>
        </tr>
        <tr>
            <td>PriceHelperStorage</td>
            <td><code>0.83</code></td>
            <td>Contract to interact with Chainlink price feeds (storage)</td>
        </tr>
    </tbody>
  </table>

[(Back to top)](#tranche-rewards)