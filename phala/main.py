from fastapi import FastAPI
from cryptography.hazmat.primitives.asymmetric.padding import PKCS1v15
from cryptography.hazmat.primitives.serialization import load_pem_private_key, load_pem_public_key
import os
import json

app = FastAPI()

# Load keys from JSON file
KEYS_FILE = "keys.json"
with open(KEYS_FILE, "r") as file:
    keys = json.load(file)

private_key = load_pem_private_key(keys["private_key"].encode(), password=None)
public_key = load_pem_public_key(keys["public_key"].encode())

@app.post('/encrypt')
async def encrypt_message(message: str):
    encrypted_message = private_key.public_key().encrypt(
        message.encode(),
        PKCS1v15()
    )
    return {"encrypted_message": encrypted_message.hex()}

@app.post('/decrypt')
async def decrypt_message(encrypted_message: str):
    decrypted_message = private_key.decrypt(
        bytes.fromhex(encrypted_message),
        PKCS1v15()
    )
    return {"decrypted_message": decrypted_message.decode()}

@app.get('/publicKey')
async def get_public_key():
    return {"public_key": keys["public_key"]}
