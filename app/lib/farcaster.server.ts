// /* eslint-disable @typescript-eslint/no-explicit-any */
// import * as ed from "@noble/ed25519";
// import { english, generateMnemonic, privateKeyToAccount } from "viem/accounts";

// import {
//   ID_GATEWAY_ADDRESS,
//   ID_REGISTRY_ADDRESS,
//   ViemLocalEip712Signer,
//   idGatewayABI,
//   idRegistryABI,
//   NobleEd25519Signer,
//   BUNDLER_ADDRESS,
//   bundlerABI,
//   KEY_GATEWAY_ADDRESS,
//   keyGatewayABI,
// } from "@farcaster/hub-nodejs";
// import { bytesToHex, createWalletClient, generateMnemonic, http } from "viem";
// impo;
// import { optimism } from "viem/chains";
// import { clientsByChainId } from "./viem.server";

// export async function createAccount() {
//   const APP_PRIVATE_KEY = process.env.AUTOMOD_FACTORY_PKEY;
//   const ALICE_PRIVATE_KEY = "0x00";

//   const publicClient = clientsByChainId[optimism.id];

//   const walletClient = createWalletClient({
//     chain: optimism,
//     transport: http(`https://optimism-mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`),
//   });

//   const app = privateKeyToAccount(APP_PRIVATE_KEY);
//   const appAccountKey = new ViemLocalEip712Signer(app as any);

//   const alice = privateKeyToAccount(ALICE_PRIVATE_KEY);
//   const aliceAccountKey = new ViemLocalEip712Signer(alice as any);

//   const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // set the signatures' deadline to 1 hour from now

//   const WARPCAST_RECOVERY_PROXY = "0x00000000FcB080a4D6c39a9354dA9EB9bC104cd7";

//   /*******************************************************************************
//    * IdGateway - register - Register an app FID.
//    *******************************************************************************/

//   /**
//    *  Get the current price to register. We're not going to register any
//    *  extra storage, so we pass 0n as the only argument.
//    */
//   const price = await publicClient.readContract({
//     address: ID_GATEWAY_ADDRESS,
//     abi: idGatewayABI,
//     functionName: "price",
//     args: [0n],
//   });

//   /**
//    *  Call `register` to register an FID to the app account.
//    */
//   const { request } = await publicClient.simulateContract({
//     account: app,
//     address: ID_GATEWAY_ADDRESS,
//     abi: idGatewayABI,
//     functionName: "register",
//     args: [WARPCAST_RECOVERY_PROXY, 0n],
//     value: price,
//   });
//   await walletClient.writeContract(request);

//   /**
//    *  Read the app fid from the Id Registry contract.
//    */
//   const APP_FID = await publicClient.readContract({
//     address: ID_REGISTRY_ADDRESS,
//     abi: idRegistryABI,
//     functionName: "idOf",
//     args: [app.address],
//   });

//   /*******************************************************************************
//    * Collect Register signature from Alice
//    *******************************************************************************/

//   let nonce = await publicClient.readContract({
//     address: KEY_GATEWAY_ADDRESS,
//     abi: keyGatewayABI,
//     functionName: "nonces",
//     args: [alice.address],
//   });

//   const registerSignatureResult = await aliceAccountKey.signRegister({
//     to: alice.address as `0x${string}`,
//     recovery: WARPCAST_RECOVERY_PROXY,
//     nonce,
//     deadline,
//   });

//   let registerSignature;
//   if (registerSignatureResult.isOk()) {
//     registerSignature = registerSignatureResult.value;
//   } else {
//     throw new Error("Failed to generate register signature");
//   }

//   /*******************************************************************************
//    * Collect Add signature from alice.
//    *******************************************************************************/

//   /**
//    *  1. Create an Ed25519 account keypair for Alice and get the public key.
//    */
//   const privateKeyBytes = ed.utils.randomPrivateKey();
//   const accountKey = new NobleEd25519Signer(privateKeyBytes);

//   let accountPubKey = new Uint8Array();
//   const accountKeyResult = await accountKey.getSignerKey();
//   if (accountKeyResult.isOk()) {
//     accountPubKey = accountKeyResult.value;

//     /**
//      *  2. Generate a Signed Key Request from the app account.
//      */
//     const signedKeyRequestMetadata = await appAccountKey.getSignedKeyRequestMetadata({
//       requestFid: APP_FID,
//       key: accountPubKey,
//       deadline,
//     });

//     if (signedKeyRequestMetadata.isOk()) {
//       const metadata = bytesToHex(signedKeyRequestMetadata.value);
//       /**
//        *  3. Read Alice's nonce from the Key Gateway.
//        */
//       nonce = await publicClient.readContract({
//         address: KEY_GATEWAY_ADDRESS,
//         abi: keyGatewayABI,
//         functionName: "nonces",
//         args: [alice.address],
//       });

//       /**
//        *  Then, collect her `Add` signature.
//        */
//       const addSignatureResult = await aliceAccountKey.signAdd({
//         owner: alice.address as `0x${string}`,
//         keyType: 1,
//         key: accountPubKey,
//         metadataType: 1,
//         metadata,
//         nonce,
//         deadline,
//       });

//       if (addSignatureResult.isOk()) {
//         const addSignature = addSignatureResult.value;
//         /**
//          *  Read the current registration price.
//          */
//         const price = await publicClient.readContract({
//           address: BUNDLER_ADDRESS,
//           abi: bundlerABI,
//           functionName: "price",
//           args: [0n],
//         });

//         /**
//          *  Call `register` with Alice's signatures, registration, and key parameters.
//          */
//         const { request } = await publicClient.simulateContract({
//           account: app,
//           address: BUNDLER_ADDRESS,
//           abi: bundlerABI,
//           functionName: "register",
//           args: [
//             {
//               to: alice.address,
//               recovery: WARPCAST_RECOVERY_PROXY,
//               sig: bytesToHex(registerSignature),
//               deadline,
//             },
//             [
//               {
//                 keyType: 1,
//                 key: bytesToHex(accountPubKey),
//                 metadataType: 1,
//                 metadata: metadata,
//                 sig: bytesToHex(addSignature),
//                 deadline,
//               },
//             ],
//             0n,
//           ],
//           value: price,
//         });
//         await walletClient.writeContract(request);
//       }
//     }
//   }
// }

// async function newSeed() {
//   const mnemonic = generateMnemonic(english);
//   const account = await mnemonicToAccount(mnemonic);
//   console.log(mnemonic);
//   console.log(`New wallet created with address: ${account.address}`);
// }

// newSeed();
