<db-plan>
{{db-plan}} <- replace with reference to @db-plan.md
</db-plan>

<prd>
{{prd}} <- replace with reference to @prd.md
</prd>

<tech-stack>
{{tech-stack}} <- replace with reference to @tech-stack.md
</tech-stack>

You are an experienced API architect whose task is to create a comprehensive REST API plan. Your plan will be based on the provided database schema, Product Requirements Document (PRD), and tech stack mentioned above. Carefully review the inputs and perform the following steps:

1. Analyze the database schema:
   - Identify main entities (tables)
   - Note relationships between entities
   - Consider any indexes that may impact API design
   - Pay attention to validation conditions specified in the schema.

2. Analyze the PRD:
   - Identify key features and functionalities
   - Note specific requirements for data operations (retrieve, create, update, delete)
   - Identify business logic requirements that go beyond CRUD operations

3. Consider the tech stack:
   - Ensure the API plan is compatible with the specified technologies.
   - Consider how these technologies may influence API design

4. Create a comprehensive REST API plan:
   - Define main resources based on database entities and PRD requirements
   - Design CRUD endpoints for each resource
   - Design endpoints for business logic described in the PRD
   - Include pagination, filtering, and sorting for list endpoints.
   - Plan appropriate use of HTTP methods
   - Define request and response payload structures
   - Include authentication and authorization mechanisms if mentioned in the PRD
   - Consider rate limiting and other security measures

Before delivering the final plan, work inside <api_analysis> tags in your thinking block to break down your thought process and ensure you've covered all necessary aspects. In this section:

1. List main entities from the database schema. Number each entity and quote the relevant part of the schema.
2. List key business logic features from the PRD. Number each feature and quote the relevant part of the PRD.
3. Map features from the PRD to potential API endpoints. For each feature, consider at least two possible endpoint designs and explain which one you chose and why.
4. Consider and list any security and performance requirements. For each requirement, quote the part of the input documents that supports it.
5. Explicitly map business logic from the PRD to API endpoints.
6. Include validation conditions from the database schema in the API plan.

This section may be quite long.

The final API plan should be formatted in markdown and include the following sections:

```markdown
# REST API Plan

## 1. Resources

- List each main resource and its corresponding database table

## 2. Endpoints

For each resource provide:

- HTTP Method
- URL Path
- Brief description
- Query parameters (if applicable)
- JSON request payload structure (if applicable)
- JSON response payload structure
- Success codes and messages
- Error codes and messages

## 3. Authentication and Authorization

- Describe the chosen authentication mechanism and implementation details

## 4. Validation and Business Logic

- List validation conditions for each resource
- Describe how business logic is implemented in the API
```

Ensure your plan is comprehensive, well-structured, and addresses all aspects of the input materials. If you need to make any assumptions due to unclear input information, clearly state them in your analysis.

The final output should consist solely of the API plan in markdown format in English, which you will save in .ai/api-plan.md and should not duplicate or repeat any work done in the thinking block.
