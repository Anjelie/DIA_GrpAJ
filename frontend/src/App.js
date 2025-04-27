import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

function DepressionAnalysisApp() {
    const [username, setUsername] = useState("");
    const [messages, setMessages] = useState([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [questionIndex, setQuestionIndex] = useState(0);
    const [demographicResponses, setDemographicResponses] = useState({});
    const messagesEndRef = useRef(null);

    const questions = [
        { 
            text: "What is your age?",
            validation: (value) => !isNaN(value) && value > 0 && value < 120,
            error: "Please enter a valid age (1-119)"
        },
        { 
            text: "What is your gender? (Male/Female)",
            validation: (value) => ["male", "female"].includes(value.toLowerCase()),
            error: "Please enter Male or Female"
        },
        { 
            text: "What is your profession? (Student/Working Professional)",
            validation: (value) => ["student", "working professional"].includes(value.toLowerCase()),
            error: "Please enter a valid profession"
        },
        { 
            text: "Academic Pressure (1-5)? Enter 0 if not applicable",
            validation: (value) => !isNaN(value) && value >= 0 && value <= 5,
            error: "Please enter a number between 0-5"
        },
        { 
            text: "Work Pressure (1-5)? Enter 0 if not applicable",
            validation: (value) => !isNaN(value) && value >= 0 && value <= 5,
            error: "Please enter a number between 0-5"
        },
        { 
            text: "Study Satisfaction (1-5)? Enter 0 if not applicable",
            validation: (value) => !isNaN(value) && value >= 0 && value <= 5,
            error: "Please enter a number between 0-5"
        },
        { 
            text: "Job Satisfaction (1-5)? Enter 0 if not applicable",
            validation: (value) => !isNaN(value) && value >= 0 && value <= 5,
            error: "Please enter a number between 0-5"
        },
        { 
            text: "What is your sleep duration? (Low/Medium/Normal/High)",
            validation: (value) => ["low", "medium", "normal", "high"].includes(value.toLowerCase()),
            error: "Please enter Low, Medium, Normal, or High"
        },
        { 
            text: "What are your dietary habits? (Healthy/Moderate/Unhealthy)",
            validation: (value) => ["healthy", "moderate", "unhealthy"].includes(value.toLowerCase()),
            error: "Please enter Healthy, Moderate, or Unhealthy"
        },
        { 
            text: "What is your degree? (High School/Undergrad/Postgrad)",
            validation: (value) => ["high school", "undergrad", "postgrad"].includes(value.toLowerCase()),
            error: "Please enter a valid degree"
        },
        { 
            text: "Have you ever had suicidal thoughts? (Yes/No)",
            validation: (value) => ["yes", "no"].includes(value.toLowerCase()),
            error: "Please enter Yes or No"
        },
        { 
            text: "How many hours do you work/study per day?",
            validation: (value) => !isNaN(value) && value >= 0 && value <= 24,
            error: "Please enter a number between 0-24"
        },
        { 
            text: "Financial Stress (1-5)?",
            validation: (value) => !isNaN(value) && value >= 1 && value <= 5,
            error: "Please enter a number between 1-5"
        },
        { 
            text: "Do you have a family history of mental illness? (Yes/No)",
            validation: (value) => ["yes", "no"].includes(value.toLowerCase()),
            error: "Please enter Yes or No"
        }
    ];

    const keys = [
        "age",
        "gender", 
        "profession",
        "academic_pressure",
        "work_pressure",
        "study_satisfaction",
        "job_satisfaction",
        "sleep_duration",
        "dietary_habits",
        "degree",
        "suicidal_thoughts",
        "work_study_hours",
        "financial_stress",
        "family_history"
    ];

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const addMessage = (content, isResponse) => {
        setMessages(prev => [...prev, { 
            content, 
            isResponse, 
            timestamp: new Date(),
            isComponent: React.isValidElement(content)
        }]);
    };

    const ConfidenceBar = ({ percentage, isDepressed, label, showWeighting }) => (
        <div style={{ width: '100%', margin: '10px 0' }}>
            {label && <div style={{ marginBottom: '5px', fontWeight: 'bold' }}>{label}</div>}
            {showWeighting && (
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
                    {showWeighting === 'twitter' ? 'Weight: 60% of final score' : 'Weight: 40% of final score'}
                </div>
            )}
            <div style={{ 
                width: '100%',
                backgroundColor: '#f1f1f1',
                borderRadius: '10px',
                overflow: 'hidden'
            }}>
                <div style={{
                    width: `${percentage}%`,
                    height: '20px',
                    backgroundColor: isDepressed ? '#ff6b6b' : '#51cf66',
                    transition: 'width 0.5s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingRight: '5px',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '12px'
                }}>
                    {percentage}%
                </div>
            </div>
            <div style={{ 
                textAlign: 'center', 
                marginTop: '5px',
                color: isDepressed ? '#ff6b6b' : '#51cf66',
                fontWeight: 'bold'
            }}>
                {isDepressed ? 'Potential depression indicators' : 'No significant indicators'}
            </div>
        </div>
    );

    const analyzeUser = async () => {
        if (!username.trim()) {
            addMessage("Please enter a valid username", true);
            return;
        }

        setIsAnalyzing(true);
        addMessage(`Analyzing Twitter user: @${username}...`, true);

        try {
            const res = await axios.post("http://127.0.0.1:5000/predict", {
                username,
            });

            if (res.data.depression) {
                const isDepressed = res.data.depression === "Depressed";
                const confidence = res.data.confidence ? (res.data.confidence * 100).toFixed(1) : 0;
                
                addMessage(
                    <div style={styles.resultSection}>
                        <h4 style={styles.resultTitle}>Twitter Analysis Results</h4>
                        <div style={{ marginBottom: '10px' }}>
                            {isDepressed 
                                ? "Our analysis of your tweets suggests potential depression indicators." 
                                : "Our analysis of your tweets doesn't suggest signs of depression."}
                        </div>
                        <ConfidenceBar 
                            percentage={confidence} 
                            isDepressed={isDepressed}
                            label="Sentiment Analysis Confidence"
                            showWeighting="twitter"
                        />
                        <div style={styles.disclaimerBox}>
                            {isDepressed
                                ? "This doesn't constitute a medical diagnosis. Please consult a professional."
                                : "Continue practicing good mental health habits."}
                        </div>
                    </div>,
                    true
                );
            }
        } catch (error) {
            console.error("Error analyzing user:", error);
            addMessage("We couldn't analyze the Twitter account. We'll proceed with demographic questions instead.", true);
        } finally {
            addMessage("To get more accurate results, please answer these questions:", true);
            askNextQuestion(0);
        }
    };

    const askNextQuestion = (nextIndex) => {
        if (nextIndex < questions.length) {
            addMessage(questions[nextIndex].text, true);
            setQuestionIndex(nextIndex);
        }
    };

    const handleUserResponse = async (event) => {
        if (event.key === "Enter") {
            const userResponse = event.target.value.trim();
            if (!userResponse) return;

            const currentQuestion = questions[questionIndex];
            if (!currentQuestion.validation(userResponse)) {
                addMessage(currentQuestion.error, true);
                event.target.value = "";
                return;
            }

            addMessage(userResponse, false);

            let storedValue = userResponse;
            if (currentQuestion.validation.toString().includes("includes(value.toLowerCase())")) {
                storedValue = userResponse.toLowerCase();
            } else if (!isNaN(userResponse)) {
                storedValue = parseFloat(userResponse);
            }

            const updatedResponses = { 
                ...demographicResponses, 
                [keys[questionIndex]]: storedValue 
            };
            setDemographicResponses(updatedResponses);

            if (questionIndex < questions.length - 1) {
                const nextIndex = questionIndex + 1;
                setTimeout(() => askNextQuestion(nextIndex), 500);
            } else {
                try {
                    addMessage("Processing your information...", true);
                    
                    // First store demographics and get demographic prediction
                    const demoRes = await axios.post("http://127.0.0.1:5000/store_demographics", {
                        username,
                        ...updatedResponses
                    });
                    
                    // Then get the final weighted prediction
                    const finalRes = await axios.post("http://127.0.0.1:5000/final_prediction", {
                        username
                    });

                    // Display demographic results
                    if (demoRes.data.depression_demographic !== undefined) {
                        const isDemoDepressed = demoRes.data.depression_demographic === 1;
                        const demoConfidence = demoRes.data.confidence_percentage || 0;
                        
                        addMessage(
                            <div style={styles.resultSection}>
                                <h4 style={styles.resultTitle}>Demographic Analysis Results</h4>
                                <div style={{ marginBottom: '10px' }}>
                                    {isDemoDepressed
                                        ? "Based on your responses, our demographic assessment suggests potential risk factors for depression."
                                        : "Based on your responses, our demographic assessment doesn't show significant risk factors for depression."}
                                </div>
                                <ConfidenceBar 
                                    percentage={demoConfidence} 
                                    isDepressed={isDemoDepressed}
                                    label="Demographic Risk Confidence"
                                    showWeighting="demographic"
                                />
                            </div>,
                            true
                        );
                    }

                    // Display final weighted results
                    if (finalRes.data.final_prediction) {
                        const isFinalDepressed = finalRes.data.final_prediction === "Depressed";
                        const weightedScore = (finalRes.data.weighted_score * 100).toFixed(1);
                        
                        addMessage(
                            <div style={styles.resultSection}>
                                <h4 style={styles.resultTitle}>Final Combined Analysis</h4>
                                <div style={{ marginBottom: '10px' }}>
                                    {isFinalDepressed
                                        ? "Our combined analysis suggests you may be experiencing depression."
                                        : "Our combined analysis doesn't suggest signs of depression."}
                                </div>
                                <ConfidenceBar 
                                    percentage={weightedScore} 
                                    isDepressed={isFinalDepressed}
                                    label="Overall Depression Risk Score"
                                />
                                <div style={{ 
                                    ...styles.disclaimerBox,
                                    backgroundColor: isFinalDepressed ? '#ffec99' : '#d3f9d8'
                                }}>
                                    <strong>Recommendation:</strong> {isFinalDepressed
                                        ? "Consider reaching out to a mental health professional for further evaluation. Early intervention can make a significant difference."
                                        : "Maintain healthy habits and check in with yourself regularly. Prevention is key to mental wellbeing."}
                                </div>
                            </div>,
                            true
                        );
                    }
                    
                    addMessage(
                        <div style={styles.disclaimerBox}>
                            <strong>Important:</strong> This tool is not a substitute for professional medical advice, diagnosis, or treatment. 
                            Always seek the advice of qualified health providers with any questions you may have.
                        </div>,
                        true
                    );
                } catch (error) {
                    console.error("Error processing information:", error);
                    addMessage("Sorry, we couldn't process your information. Please try again later.", true);
                } finally {
                    setIsAnalyzing(false);
                }
            }

            event.target.value = "";
        }
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.header}>Mental Health Analysis Tool</h2>
            <p style={styles.subheader}>This tool analyzes potential depression indicators from Twitter and demographic information</p>
            
            <div style={styles.inputContainer}>
                <input
                    type="text"
                    placeholder="Enter Twitter username (without @)"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={styles.usernameInput}
                    disabled={isAnalyzing}
                />
                <button 
                    onClick={analyzeUser} 
                    style={styles.analyzeButton}
                    disabled={isAnalyzing || !username.trim()}
                >
                    {isAnalyzing ? "Processing..." : "Analyze"}
                </button>
            </div>
            
            <div style={styles.chatContainer}>
                {messages.map((msg, index) => (
                    <div 
                        key={index} 
                        style={{
                            ...styles.message,
                            ...(msg.isResponse ? styles.responseMessage : styles.userMessage)
                        }}
                    >
                        {msg.isComponent ? msg.content : msg.content}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            
            {isAnalyzing && questionIndex < questions.length && (
                <input
                    type="text"
                    placeholder="Type your answer and press Enter..."
                    onKeyDown={handleUserResponse}
                    style={styles.responseInput}
                    autoFocus
                />
            )}

            <div style={styles.disclaimer}>
                <p><strong>Disclaimer:</strong> This tool is for informational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment.</p>
            </div>
        </div>
    );
}

const styles = {
    container: {
        maxWidth: "600px",
        margin: "20px auto",
        padding: "20px",
        borderRadius: "10px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        backgroundColor: "#f9f9f9",
        fontFamily: "Arial, sans-serif"
    },
    header: {
        color: "#2c3e50",
        textAlign: "center",
        marginBottom: "5px"
    },
    subheader: {
        color: "#7f8c8d",
        textAlign: "center",
        fontSize: "14px",
        marginBottom: "20px"
    },
    inputContainer: {
        display: "flex",
        gap: "10px",
        marginBottom: "20px"
    },
    usernameInput: {
        flex: 1,
        padding: "12px",
        borderRadius: "5px",
        border: "1px solid #ddd",
        fontSize: "16px"
    },
    analyzeButton: {
        padding: "12px 20px",
        backgroundColor: "#3498db",
        color: "white",
        border: "none",
        borderRadius: "5px",
        cursor: "pointer",
        fontSize: "16px",
        transition: "background-color 0.3s",
        minWidth: "100px",
        ':hover': {
            backgroundColor: "#2980b9"
        },
        ':disabled': {
            backgroundColor: "#bdc3c7",
            cursor: "not-allowed"
        }
    },
    chatContainer: {
        height: "400px",
        overflowY: "auto",
        padding: "15px",
        backgroundColor: "white",
        borderRadius: "5px",
        border: "1px solid #ddd",
        marginBottom: "10px"
    },
    message: {
        padding: "12px 16px",
        borderRadius: "18px",
        marginBottom: "12px",
        maxWidth: "80%",
        wordWrap: "break-word",
        lineHeight: "1.5",
        boxShadow: "0 1px 2px rgba(0,0,0,0.1)"
    },
    userMessage: {
        backgroundColor: "#e3f2fd",
        marginLeft: "auto",
        borderBottomRightRadius: "5px"
    },
    responseMessage: {
        backgroundColor: "#f1f1f1",
        marginRight: "auto",
        borderBottomLeftRadius: "5px"
    },
    responseInput: {
        width: "100%",
        padding: "12px",
        borderRadius: "5px",
        border: "1px solid #ddd",
        fontSize: "16px",
        boxSizing: "border-box"
    },
    disclaimer: {
        fontSize: "12px",
        color: "#7f8c8d",
        marginTop: "20px",
        padding: "10px",
        backgroundColor: "#ecf0f1",
        borderRadius: "5px"
    },
    resultSection: {
        margin: '15px 0',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        borderLeft: '4px solid #3498db'
    },
    resultTitle: {
        color: '#2c3e50',
        marginBottom: '10px',
        fontSize: '16px',
        fontWeight: 'bold'
    },
    disclaimerBox: {
        marginTop: '10px',
        padding: '10px',
        backgroundColor: '#fff3bf',
        borderRadius: '5px',
        borderLeft: '3px solid #ffd43b',
        fontSize: '14px'
    }
};

export default DepressionAnalysisApp;