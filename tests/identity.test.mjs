import assert from 'node:assert/strict';
import test from 'node:test';
import {resolve} from 'node:path';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {loadSource,root} from './helpers.mjs';
const {authenticate,authorize}=loadSource(resolve(root,'worker/identity'));
const {privateResponse}=loadSource(resolve(root,'worker/http'));
const config={ACCESS_TEAM_DOMAIN:'finance-test.cloudflareaccess.com',ACCESS_AUD:'finance-audience'};
const request=headers=>new Request('https://finance.test/api/finance',{headers});

test('unverified email headers and local URLs never authenticate by default',async()=>{
  for(const headers of [{'cf-access-authenticated-user-email':'victim@test'},{'oai-authenticated-user-email':'victim@test'},{}]) await assert.rejects(authenticate(request(headers),config),{status:401});
  await assert.rejects(authenticate(new Request('http://localhost/api/finance'),{}),{status:503});
  await assert.rejects(authenticate(request({}),{LOCAL_DEV_AUTH:'true'}),{status:503});
  const principal=await authenticate(new Request('http://localhost/api/finance'),{LOCAL_DEV_AUTH:'true'});
  assert.equal(principal.owner,'owner@local');
});
test('signature, expiration, issuer and audience are checked using public JWKS',async t=>{
  const {publicKey,privateKey}=await generateKeyPair('RS256');
  const jwk={...await exportJWK(publicKey),kid:'test-key',alg:'RS256',use:'sig'};
  t.mock.method(globalThis,'fetch',async url=>{
    assert.equal(String(url),'https://finance-test.cloudflareaccess.com/cdn-cgi/access/certs');
    return Response.json({keys:[jwk]});
  });
  const sign=(claims={})=>new SignJWT({email:'real-owner@test',...claims}).setProtectedHeader({alg:'RS256',kid:'test-key'}).setSubject('subject').setIssuedAt().setExpirationTime('5m').setIssuer('https://finance-test.cloudflareaccess.com').setAudience('finance-audience').sign(privateKey);
  const token=await sign(); const principal=await authenticate(request({'cf-access-jwt-assertion':token,'cf-access-authenticated-user-email':'victim@test'}),config);
  assert.equal(principal.owner,'real-owner@test');
  const expired=await new SignJWT({email:'real-owner@test'}).setProtectedHeader({alg:'RS256',kid:'test-key'}).setSubject('s').setIssuedAt().setExpirationTime(1).setIssuer('https://finance-test.cloudflareaccess.com').setAudience('finance-audience').sign(privateKey);
  await assert.rejects(authenticate(request({'cf-access-jwt-assertion':expired}),config),{status:401});
  await assert.rejects(authenticate(request({'cf-access-jwt-assertion':token}),{...config,ACCESS_AUD:'wrong'}),{status:401});
  const parts=token.split('.'); parts[1]=Buffer.from(JSON.stringify({email:'victim@test'})).toString('base64url');
  await assert.rejects(authenticate(request({'cf-access-jwt-assertion':parts.join('.')}),config),{status:401});
});
test('permissions are enforced on the server and private responses cannot be cached',()=>{
  const principal={subject:'reader',owner:'reader@test',permissions:['finance:read']};
  assert.doesNotThrow(()=>authorize(principal,'finance:read'));
  for(const permission of ['finance:write','finance:export','finance:advisor']) assert.throws(()=>authorize(principal,permission),{status:403});
  const response=privateResponse(Response.json({ok:true})); assert.equal(response.headers.get('cache-control'),'no-store');
});
