const AIAnalyzerService = require("../services/AiAgentService");

exports.analyzeResults = async (req, res) => {

  try {

    const data = req.body;

    const analysis = await AIAgentService.analyzeSecurityResults(data);

    res.json({
      success: true,
      analysis: analysis
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      error: error.message
    });

  }

};