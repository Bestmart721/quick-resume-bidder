export default [
  `I've been working as the role mentioned in the job description provided below.
    - Name: Matthew F. Sliger
    IM Digital, Boca Raton, FL • Senior Software Engineer Aug 2022 – Jul 2024
    Point B, Charlotte, NC • Senior Software Engineer Jan 2018 – Jun 2022
    Southshore Managed IT Group, Portage, IN • Full Stack Developer Oct 2013 – Sep 2017
    Now, I'm looking for a new opportunity.
    `,

  `Based on the job description, generate a resume that is **highly tailored to the role**, expanding the tech stack, tools, and frameworks based on common industry knowledge and the JD. Predict and greatly expand the tech stacks and skills, doubling the range as needed while focusing on specific, relevant tools.`,

  `**Adaptive Expansion of Tech Stacks**:
    - If the JD lacks detail, expand the resume to include at least 30 relevant tech stacks, skills, and tools, predicting and including commonly associated technologies and specific tools & libraries.
    - If the JD is more detailed, focus on the relevant tech stacks mentioned and include only related tools directly applicable to the role.
    - Ignore company introductions in the JD.
    - Emphasize experience with specific frameworks if only a language is required.`,

  `**Predict and Enhance Key Abilities**:
    - Extract key abilities from the JD and expand on them by predicting relevant abilities commonly required for the role.
    - Ensure both expanded technical skills and soft skills are integrated into the experience section.
    - The skills section should include only hard skills and technologies.`,

  `**Skills Section Requirements**:
    - In the technical skills section, list at least 30 relevant tech stacks, skills, and tools, focusing on hard skills and specific tools like programming languages, frameworks, and development environments.
    - Use fewer than 6 groups.
    - Group names should be short, and each group should contain 5 to 8 keywords.
    - Don't include soft skills or add bolded styles with any asterisks.`,

  `**Detailed Experiences Generation 1**:
    - For IM Digital: Generate 12 detailed technical bullet points that align with the JD.
    - Each sentences must be 30 words long.
    - Include industry-specific trends or technologies. Include both tech stacks and soft skills (e.g., collaboration, adaptability).`,
    
  `**Detailed Experiences Generation 2**:
    - For Point B: Generate 9 experience bullet points and focus on key JD skills.`,
    
  `**Detailed Experiences Generation 3**:
    - For Southshore Managed IT Group: Generate 7 bullet points, reflecting the skills relevant to that timeframe.
    - Include a numeric measurement only in the last bullet point.`,

  `**Consistent Formatting**:
    - Bold all key abilities, technical skills, and tools consistently using asterisks, e.g., **React**. This should be applied across experience, skills, and summary sections for ATS optimization.`,

  `**ATS Optimization and Summary Formatting**:
    - Bold key abilities and technical skills with asterisks for ATS readability.
    - Structure the resume with **Summary, Technical Skills, and Experiences** sections.
    - Ensure the summary is concise, highlighting explicitly mentioned and inferred strengths with a focus on relevant skills. Indicate 11 years of experience in software development, with a focus on web and mobile applications.
    - The roleTitle should match the JD exactly. The developerTitle can reflect your most recent role (e.g., Senior Software Engineer) but should align with the JD to appeal to HR as a fitting candidate.`
]