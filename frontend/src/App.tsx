import { AppConfig, UserSession, showConnect } from '@stacks/connect';
import { StacksTestnet } from '@stacks/network';
import { callReadOnlyFunction, uintCV, cvToValue, makeContractCall, broadcastTransaction, AnchorMode, PostConditionMode } from '@stacks/transactions';
import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [count, setCount] = useState<number>(0);
  const [userSession, setUserSession] = useState<UserSession | null>(null);

  const appConfig = new AppConfig(['store_write', 'publish_data']);
  const session = new UserSession({ appConfig });
  const network = new StacksTestnet();

  // Contract details (update these after deployment)
  const contractAddress = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
  const contractName = 'counter';

  useEffect(() => {
    if (session.isUserSignedIn()) {
      setUserSession(session);
      fetchCount();
    } else if (session.isSignInPending()) {
      session.handlePendingSignIn().then((userData) => {
        setUserSession(session);
        fetchCount();
      });
    }
  }, []);

  const connectWallet = () => {
    showConnect({
      appDetails: {
        name: 'Centrifuge Counter',
        icon: window.location.origin + '/vite.svg',
      },
      redirectTo: '/',
      onFinish: () => {
        window.location.reload();
      },
      userSession: session,
    });
  };

  const fetchCount = async () => {
    try {
      const result = await callReadOnlyFunction({
        contractAddress,
        contractName,
        functionName: 'get-count',
        functionArgs: [],
        network,
        senderAddress: contractAddress, // Using contract address as sender for read-only
      });
      setCount(Number(cvToValue(result)));
    } catch (e) {
      console.error('Error fetching count:', e);
    }
  };

  const handleTransaction = async (functionName: string) => {
    if (!userSession?.isUserSignedIn()) return;

    const options = {
      contractAddress,
      contractName,
      functionName,
      functionArgs: [],
      network,
      appDetails: {
        name: 'Centrifuge Counter',
        icon: window.location.origin + '/vite.svg',
      },
      postConditionMode: PostConditionMode.Allow,
      onFinish: (data: any) => {
        console.log('Transaction submitted:', data);
        // Optimistic update or polling could be added here
      },
    };

    await showConnect({
      ...options,
      userSession,
      // @ts-ignore - types mismatch in some versions of stacks.js
      onFinish: options.onFinish
    });
    // For direct transaction signing without re-auth, we use openContractCall
    // But showConnect is a wrapper that handles auth if needed.
    // Let's use openContractCall from @stacks/connect actually.
  };

  // Re-implementing with openContractCall pattern for better UX
  const executeAction = (action: 'increment' | 'decrement') => {
    if (!userSession?.isUserSignedIn()) return;
    
    // @ts-ignore
    const { openContractCall } = import('@stacks/connect');
    
    // Dynamic import to avoid SSR issues if any (not here, but good practice)
    import('@stacks/connect').then(({ openContractCall }) => {
      openContractCall({
        network,
        anchorMode: AnchorMode.Any,
        contractAddress,
        contractName,
        functionName: action,
        functionArgs: [],
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data) => {
          console.log('TxId:', data.txId);
        },
      });
    });
  };

  return (
    <div className="card">
      <h1>Centrifuge Counter</h1>
      
      {!userSession?.isUserSignedIn() ? (
        <button onClick={connectWallet}>Connect Wallet</button>
      ) : (
        <div>
          <p>Current Count: {count}</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button onClick={() => executeAction('increment')}>Increment (+)</button>
            <button onClick={() => executeAction('decrement')}>Decrement (-)</button>
          </div>
          <p style={{ marginTop: '20px', fontSize: '0.8em' }}>
            Signed in as: {userSession.loadUserData().profile.stxAddress.testnet}
          </p>
          <button onClick={() => {
            session.signUserOut();
            setUserSession(null);
          }}>Sign Out</button>
        </div>
      )}
    </div>
  );
}

export default App;
