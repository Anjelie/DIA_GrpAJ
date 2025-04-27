from flask import Flask, request, jsonify
import tensorflow as tf
import numpy as np
import sqlite3
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences
import requests
from bs4 import BeautifulSoup
import random
import time
import joblib
from flask_cors import CORS
from datetime import datetime
import re
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

app = Flask(__name__)
CORS(app)

# Initialize database
def init_db():
    conn = sqlite3.connect("chatbot.db")
    cursor = conn.cursor()
    
    # Create users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            depression_score REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create demographics table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS demographics (
            username TEXT PRIMARY KEY,
            age INTEGER,
            gender TEXT,
            profession TEXT,
            academic_pressure REAL,
            work_pressure REAL,
            study_satisfaction REAL,
            job_satisfaction REAL,
            sleep_duration TEXT,
            dietary_habits TEXT,
            degree TEXT,
            suicidal_thoughts TEXT,
            work_study_hours REAL,
            financial_stress REAL,
            family_history TEXT,
            FOREIGN KEY (username) REFERENCES users(username)
        )
    """)
    
    conn.commit()
    conn.close()

# Initialize the database when the app starts
init_db()

# Load models
model = tf.keras.models.load_model("sentiment_model.h5")
demographic_model = joblib.load("depression_model.h5")
demographic_scaler = joblib.load("scaler.h5")
demographic_encoder = joblib.load("encoder.h5")

# Nitter instances
nitter_instances = ["http://xcancel.com"]

# Tokenizer settings 
vocab_size = 10282
max_length = 100
oov_token = "<OOV>"
tokenizer = Tokenizer(num_words=vocab_size, oov_token=oov_token)


# Updated fetch_tweets function with enhanced capabilities
def fetch_tweets_nitter(username, max_tweets=100):
    """Tertiary fallback using Nitter instances"""
    print(f"[*] Trying to fetch tweets for {username} from Nitter...")
    
    for instance in nitter_instances:
        try:
            url = f"{instance}/{username}"
            print(f"[*] Trying Nitter instance: {url}")
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                tweet_divs = soup.find_all("div", {"class": "tweet-content"})
                tweets = [div.get_text(strip=True) for div in tweet_divs]
                
                if tweets:
                    print(f"[+] Found {len(tweets)} tweets at {instance}")
                    return tweets[:max_tweets]
        
        except Exception as e:
            print(f"[!] Nitter instance {instance} failed: {e}")
    
    print("[!] All Nitter instances failed.")
    return None


def fetch_tweets_requests(username, max_tweets=100):
    """Primary method using requests + BeautifulSoup"""
    print(f"[*] Trying to fetch tweets for {username} using requests...")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }
    
    try:
        url = f"https://twitter.com/{username}"
        response = requests.get(url, headers=headers, timeout=15)
        print(f"[*] Response status code: {response.status_code}")
        
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            tweets = []

            # Try multiple selectors
            selectors = [
                'div[data-testid="tweetText"]',
                'article div[lang="en"] span',
                'div[data-testid="tweet"] div[lang="en"]'
            ]
            
            for selector in selectors:
                tweet_elements = soup.select(selector)
                print(f"[*] Found {len(tweet_elements)} elements with selector '{selector}'")
                
                if tweet_elements:
                    tweets.extend([tweet.get_text(strip=True) for tweet in tweet_elements])
                    if len(tweets) >= max_tweets:
                        break

            print(f"[*] Total tweets found with requests: {len(tweets)}")
            return tweets[:max_tweets] if tweets else None

        else:
            print("[!] Non-200 response from Twitter.")
            return None

    except Exception as e:
        print(f"[!] Requests method failed: {e}")
        return None

def fetch_tweets_selenium(username, max_tweets=100):
    """Fallback method using Selenium with scrolling"""
    try:
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--window-size=1920,1080")

        driver = webdriver.Chrome(options=chrome_options)
        driver.get(f"https://twitter.com/{username}")
        time.sleep(5)  # Wait for page to load
        
        tweets = set()
        scroll_attempt = 0
        max_scrolls = 15  # Number of times to scroll down

        while len(tweets) < max_tweets and scroll_attempt < max_scrolls:
            tweet_elements = driver.find_elements(By.CSS_SELECTOR, 'div[data-testid="tweetText"]')
            
            for tweet in tweet_elements:
                tweets.add(tweet.text.strip())
            
            print(f"[*] Selenium found {len(tweets)} tweets after {scroll_attempt + 1} scrolls.")
            
            # Scroll down to load more tweets
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(3)  # Wait for new tweets to load
            scroll_attempt += 1

        return list(tweets)[:max_tweets] if tweets else None

    except Exception as e:
        print(f"Selenium method failed: {e}")
        return None
    finally:
        if 'driver' in locals():
            driver.quit()


def fetch_tweets(username, max_tweets=100):
    """Combined fetching approach with fallback"""
    print(f"[+] Fetching tweets for @{username}")

    tweets = fetch_tweets_requests(username, max_tweets)

    if not tweets:
        print(f"[!]trying Nitter...")
        tweets = fetch_tweets_nitter(username, max_tweets)

    if not tweets:
        print(f"[!] Nitter failed, trying Selenium...")
        tweets = fetch_tweets_selenium(username, max_tweets)

    

    if tweets:
        print(f"[+] Successfully fetched {len(tweets)} tweets for @{username}")
    else:
        print(f"[!] Failed to fetch any tweets for @{username}")

    return tweets

def preprocess_text(texts):
    if not texts:
        print("Error: No tweets to process!")
        return np.array([])
    
    tokenizer.fit_on_texts(texts)
    sequences = tokenizer.texts_to_sequences(texts)

    if any(seq is None for seq in sequences):
        print("Warning: Some tweets could not be tokenized properly!")

    sequences = [seq for seq in sequences if seq]

    if not sequences:
        print("Error: No valid sequences after tokenization!")
        return np.array([])

    padded_sequences = pad_sequences(sequences, maxlen=max_length, padding='post', truncating='post')
    print(f"Processed {len(texts)} tweets into {len(padded_sequences)} valid sequences.")
    return padded_sequences

@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Welcome to the ChatApp API!"})

@app.route("/predict", methods=["POST"])
def predict():
    data = request.json
    username = data.get("username", "")
    
    if not username:
        return jsonify({"error": "Username is required"}), 400

    print(f"Fetching tweets for: {username}")
    tweets = fetch_tweets(username, max_tweets=100)

    if isinstance(tweets, list) and len(tweets) > 0 and "All instances blocked" in tweets[0]:
        return jsonify({"error": "Failed to fetch tweets. Try again later."}), 500

    print(f"Processing tweets for {username}")
    processed_tweets = preprocess_text(tweets)

    print(f"Running prediction for {username}")
    predictions = model.predict(processed_tweets)
    avg_confidence = np.mean(predictions)
    result = "Depressed" if avg_confidence > 0.5 else "Not Depressed"

    print(f"Prediction Result for {username}: {result} (Confidence: {avg_confidence:.2f})")

    try:
        conn = sqlite3.connect("chatbot.db")
        cursor = conn.cursor()

        cursor.execute(
            "INSERT OR REPLACE INTO users (username, depression_score) VALUES (?, ?)",
            (username, float(avg_confidence))
        )
        conn.commit()
        
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        return jsonify({"error": "Database operation failed"}), 500
    finally:
        conn.close()

    return jsonify({
        "username": username, 
        "depression": result, 
        "confidence": float(avg_confidence)
    })

categorical_columns = [
    'Gender', 
    'Profession', 
    'Sleep Duration', 
    'Dietary Habits', 
    'Degree', 
    'Have you ever had suicidal thoughts ?', 
    'Family History of Mental Illness'
]

@app.route("/store_demographics", methods=["POST"])
def predict_demographic():
    data = request.json
    username = data.get("username", "")

    if not username:
        return jsonify({"error": "Username is required"}), 400

    try:
        # Prepare the input data
        user_data_dict = {
            "Gender": data["gender"],
            "Profession": data["profession"],
            "Sleep Duration": data["sleep_duration"],
            "Dietary Habits": data["dietary_habits"],
            "Degree": data["degree"],
            "Have you ever had suicidal thoughts ?": data["suicidal_thoughts"],
            "Family History of Mental Illness": data["family_history"],
        }

        # Debug print to verify input data
        print("Received demographic data:", user_data_dict)

        # Encode categorical data
        encoded_data = demographic_encoder.transform([[user_data_dict[col] for col in categorical_columns]])
        print("Encoded categorical data:", encoded_data)

        # Prepare numerical data
        numerical_data = [
            int(data["age"]),
            float(data["academic_pressure"]),
            float(data["work_pressure"]),
            float(data["study_satisfaction"]),
            float(data["job_satisfaction"]),
            float(data["work_study_hours"]),
            float(data["financial_stress"])
        ]
        print("Numerical data:", numerical_data)

        # Combine and scale features
        final_input = numerical_data + list(encoded_data[0])
        scaled_input = demographic_scaler.transform([final_input])
        print("Scaled input:", scaled_input)

        # Get prediction and probabilities
        prediction = demographic_model.predict(scaled_input)
        probabilities = demographic_model.predict_proba(scaled_input)
        print("Raw probabilities:", probabilities)

        # Calculate confidence percentage
        confidence_percentage = round(probabilities[0][1] * 100, 2)  # Probability of depression (class 1)
        predicted_class = int(prediction[0])
        print(f"Prediction: {predicted_class}, Confidence: {confidence_percentage}%")

        # Store demographic data
        try:
            conn = sqlite3.connect("chatbot.db")
            cursor = conn.cursor()

            cursor.execute("""
                INSERT OR REPLACE INTO demographics (
                    username, age, gender, profession, academic_pressure, work_pressure,
                    study_satisfaction, job_satisfaction, sleep_duration, dietary_habits, degree,
                    suicidal_thoughts, work_study_hours, financial_stress, family_history
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                username,
                int(data["age"]),
                data["gender"],
                data["profession"],
                float(data["academic_pressure"]),
                float(data["work_pressure"]),
                float(data["study_satisfaction"]),
                float(data["job_satisfaction"]),
                data["sleep_duration"],
                data["dietary_habits"],
                data["degree"],
                data["suicidal_thoughts"],
                float(data["work_study_hours"]),
                float(data["financial_stress"]),
                data["family_history"]
            ))
            
            conn.commit()
        except sqlite3.Error as e:
            print(f"Database error: {e}")
            return jsonify({"error": "Failed to store demographic data"}), 500
        finally:
            conn.close()

        return jsonify({
            "depression_demographic": predicted_class,
            "confidence_percentage": confidence_percentage,
            "message": "Data stored successfully"
        })

    except KeyError as e:
        print(f"Missing key in input data: {e}")
        return jsonify({"error": f"Missing required field: {str(e)}"}), 400
    except Exception as e:
        print(f"Unexpected error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/final_prediction", methods=["POST"])
def final_prediction():
    data = request.json
    username = data.get("username", "")

    if not username:
        return jsonify({"error": "Username is required"}), 400

    try:
        # Get tweet-based prediction
        conn = sqlite3.connect("chatbot.db")
        cursor = conn.cursor()
        
        # Get tweet prediction score
        cursor.execute("SELECT depression_score FROM users WHERE username = ?", (username,))
        tweet_result = cursor.fetchone()
        
        if not tweet_result:
            return jsonify({"error": "No tweet analysis found for this user"}), 404
        
        tweet_score = float(tweet_result[0])
        
        # Get demographic prediction score
        cursor.execute("""
            SELECT academic_pressure, work_pressure, study_satisfaction, job_satisfaction, 
                   work_study_hours, financial_stress, gender, profession, sleep_duration, 
                   dietary_habits, degree, suicidal_thoughts, family_history, age
            FROM demographics WHERE username = ?
        """, (username,))
        demo_data = cursor.fetchone()
        
        if not demo_data:
            return jsonify({"error": "No demographic data found for this user"}), 404
        
        # Prepare demographic data for prediction
        demo_dict = {
            "age": demo_data[13],
            "academic_pressure": demo_data[0],
            "work_pressure": demo_data[1],
            "study_satisfaction": demo_data[2],
            "job_satisfaction": demo_data[3],
            "work_study_hours": demo_data[4],
            "financial_stress": demo_data[5],
            "Gender": demo_data[6],
            "Profession": demo_data[7],
            "Sleep Duration": demo_data[8],
            "Dietary Habits": demo_data[9],
            "Degree": demo_data[10],
            "Have you ever had suicidal thoughts ?": demo_data[11],
            "Family History of Mental Illness": demo_data[12],
        }
        
        # Encode categorical data
        encoded_data = demographic_encoder.transform([[demo_dict[col] for col in categorical_columns]])
        
        # Prepare numerical data
        numerical_data = [
            int(demo_dict["age"]),
            float(demo_dict["academic_pressure"]),
            float(demo_dict["work_pressure"]),
            float(demo_dict["study_satisfaction"]),
            float(demo_dict["job_satisfaction"]),
            float(demo_dict["work_study_hours"]),
            float(demo_dict["financial_stress"])
        ]
        
        # Combine and scale features
        final_input = numerical_data + list(encoded_data[0])
        scaled_input = demographic_scaler.transform([final_input])
        
        # Get demographic prediction probabilities
        demo_probabilities = demographic_model.predict_proba(scaled_input)
        demo_score = float(demo_probabilities[0][1])  # Probability of depression (class 1)
        
        # Calculate weighted average (60% tweet, 40% demographic)
        weighted_score = (0.6 * tweet_score) + (0.4 * demo_score)
        final_prediction = "Depressed" if weighted_score > 0.5 else "Not Depressed"
        
        return jsonify({
            "username": username,
            "final_prediction": final_prediction,
            "weighted_score": weighted_score,
            "tweet_score": tweet_score,
            "demographic_score": demo_score,
            "message": "Weighted prediction calculated successfully"
        })
        
    except Exception as e:
        print(f"Error calculating final prediction: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


if __name__ == "__main__":
    app.run(debug=True)

