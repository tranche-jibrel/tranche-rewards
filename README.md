# tranche-rewards

## how does Slicetroller contract works

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

## Tests

Ways to test contracts:

All tests (ganache required: npx ganache-cli --deterministic -l 12000000), gas reporter included:

    `truffle test`   

1 test only (ganache required: npx ganache-cli --deterministic -l 12000000), gas reporter included:

    `truffle test ./test/IncentiveRewards.test.js`   

Solidity Coverage (no ganache required):

    `truffle run coverage --network development --file="<filename>"`   
    
     

## Contracts Size (main contracts, no interfaces, no test contracts)
Limit is 24 KiB for single contract
<table>
    <thead>
      <tr>
        <th>Contract</th>
        <th>Size</th>
      </tr>
    </thead>
    <tbody>
        <tr>
            <td>IncentiveRewards</td>
            <td><code>4.18 KiB</code></td>
        </tr>
        <tr>
            <td>IncentiveRewardsStorage</td>
            <td><code>1.04 KiB</code></td>
        </tr>
        <tr>
            <td>IncentiveRewardsFactory</td>
            <td><code>8.83 KiB</code></td>
        </tr>
        <tr>
            <td>IncentiveRewardsFactoryStorage</td>
            <td><code>1.08 KiB</code></td>
        </tr>
        <tr>
            <td>IncentivesController</td>
            <td><code>14.14 KiB</code></td>
        </tr>
        <tr>
            <td>IncentivesControllerStorage</td>
            <td><code>1.93 KiB</code></td>
        </tr>
        <tr>
            <td>Markets</td>
            <td><code>11.65 KiB</code></td>
        </tr>
        <tr>
            <td>MarketsStorage</td>
            <td><code>1.32 KiB</code></td>
        </tr>
        <tr>
            <td>Model</td>
            <td><code>2.02 KiB</code></td>
        </tr>
    </tbody>
  </table>
