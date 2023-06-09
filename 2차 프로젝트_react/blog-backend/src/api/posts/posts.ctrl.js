import Post from "../../models/post";
import mongoose from "mongoose";
import Joi from 'joi';
import sanitizeHtml from 'sanitize-html';


const { ObjectId } = mongoose.Types;
const removeHTMLAndShorten = body => {
    const filtered = sanitizeHtml(body, {
        allowedTags: [],
    });
    return filtered.length < 200 ? filtered: `${filtered.slice(0, 200)}...`;
};



const sanitizeOption = {
    allowedTags: [
        'h1',
        'h2',
        'b',
        'i',
        'u',
        's',
        'p',
        'ul',
        'ol',
        'li',
        'blockquote',
        'a',
        'img',
    ],
    allowedAttributes : {
        a: ['href', 'name', 'target'],
        img: ['src'],
        li: ['class'],
    },
    allowedSchemes: ['data', 'http']
};

export const getPostById = async (ctx, next) => {
    const {id} = ctx.params;
    if(!ObjectId.isValid(id)){
        ctx.status = 400; //bad request
        return;
    }
    try{
        const post = await Post.findById(id);
        //포스트가 존재하지 않을때
        if(!post){
            ctx.status = 404;
            return;
        }
        ctx.state.post = post;
        return next()
    } catch(e){
        ctx.throw(500, e)
    }
    
};

export const write = async ctx => {
    const schema = Joi.object().keys({
        title: Joi.string().required(),
        body: Joi.string().required(),
        category: Joi.string().required(),
        postCount: Joi.number(),
        tags : Joi.array()
        .items(Joi.string())
        .required(),
    })

    //검증하고나서 검증 실패인 경우 에러 처리
    const result = schema.validate(ctx.request.body)
    if(result.error) {
        ctx.status = 400; //Bad Request
        ctx.body = result.error;
        return;
    }
    const { title, body, tags, category, postCount } = ctx.request.body;
    const post = new Post( {
        title,
        body: sanitizeHtml(body, sanitizeOption),
        tags,
        user : ctx.state.user,
        postCount,
        category
    })
    try {
        await post.save();
        ctx.body = post;
        
    } catch(e) {
        ctx.throw(500, e);
    }
};



export const list = async ctx => {
    //query는 문자열이기 때문에 숫자로 변환해 주어야 합니다. 
    //값이 주어지지 않았다면 1을 기본으로 사용합니다. 
    const page = parseInt(ctx.query.page || '1', 10);
    
    if(page < 1){
        ctx.status = 400;
        return;
    }
    const {tag, username} = ctx.query;
    //tag, username값이 유효하면 객체 안에 넣고, 그렇지 않으면 넣지 않음
    const query = {
        ...(username ? { 'user.username' : username } : {}),
        ...(tag? {tags: tag} : {}),
    };
    try {
        const posts = await Post.find(query)
        .sort({ _id: -1})
        .limit(10)
        .skip((page - 1)*10)
        .lean()
        .exec();
        const postCount = await Post.countDocuments(query).exec();
        ctx.set('Last-Page', Math.ceil(postCount / 10))
        ctx.body = posts.map(post => ({
            ...post,
            body: removeHTMLAndShorten(post.body),
        }))
    } catch(e) {
        ctx.throw(500, e);
    }
}
export const read = ctx => {
    ctx.body = ctx.state.post;
    // const {id} =ctx.params;
    // try{
    //     const post = await Post.findById(id).exec();
    //     if(!post) {
    //         ctx.status = 404;
    //         return;
    //     }
    //     ctx.body = post;
    // }catch(e) {
    //     ctx.throw(500, e);
    // }
}
export const remove = async ctx => {
    const {id} = ctx.params;
    try{
        await Post.findByIdAndDelete(id).exec();
        ctx.status= 204;
    }catch(e){
        ctx.throw(500, e)
    }
}


export const update = async ctx => {
    const { id } =ctx.params;
    //write에서 사용한 schema와 비슷한데 require()이 없습니다.
    const schema = Joi.object().keys({
        title: Joi.string(),
        body: Joi.string(),
        tags : Joi.array().items(Joi.string())  
    })

    //검증하고나서 검증 실패인 경우 에러 처리
    const result = schema.validate(ctx.request.body);
    if(result.error){
        ctx.status= 400;
        ctx.body = result.error;
        return;
    }
    const nextData = { ...ctx.request.body }; //객체를 복사하고 
    //body 값이 주어졌으면 html 필터링
    if(nextData.body) {
        nextData.body = sanitizeHtml(nextData.body, sanitizeOption);
    } try{
        const post = await Post.findByIdAndUpdate(id, nextData, {
            new: true, //이값을 설정하면 업데이트된 데이터를 반환합니다. 
            //false일때 업데이트 되기 전의 데이터를 반환합니다. 
        }).exec();
        if(!post) {
            ctx.status = 404;
            return;

        }
        ctx.body = post;
    }catch(e) {
        ctx.throw(500, e)
    }
}


export const checkOwnPost = (ctx, next) => {
    const { user, post } = ctx.state;
    if(post.user._id.toString() !== user._id){
        ctx.status = 403;
        return;
    }
    return next();
}


// let postId = 1; //id의 초깃값입니다.

// //posts 배열 초기 데이터
// const posts = [
//     {
//         id: 1,
//         title : '제목',
//         body : '내용',
//     },
// ];

// 포스트 작성
// post/api/posts {title, body}

// export const write = ctx => {
//    // rest api의 request body는 ctx.request.body에서 조회할 수 있습니다.
//    const { title, body } = ctx.request.body;
//    postId +=1 //기존postid값에 1을 더합니다. 
//    const post = { id: postId, title, body}
//    posts.push(post)
//    ctx.body = post;
// }

// 포스트 목록 조회
// GET /api/posts


// export const list = ctx => {
//     ctx.body = posts;
// };

// // 특정 포스트 조회
// // GET /api/posts/:id
// export const read = ctx => {
//    const {id} = ctx.params;
//     //주어진 id값으로 포스트를 찾습니다. 
//     //파라미터로 받아 온 값은 문자열 형식으로 파라미터를 숫자로 변환하거나 
//     //비교할 p.id 값을 문자열로 변경해야 합니다. 
//     const post = posts.find(p => p.id.toString() === id);
//     //포스트가 없으면 오류를 반환합니다. 
//     if(!post){
//         ctx.status = 404;
//         ctx.body = {
//             message : '포스트가 존재하지 않습니다.'
//         };
//         return;
//     }
//     ctx.body = post;
// }

// // 특정 포스트 제거 
// // DELETE /api/posts/:id

// export const remove = ctx => {
//     const { id } = ctx.params;
//     const index = posts.findIndex(p => p.id.toString() === id);
//         if( index === -1) {
//             ctx.status = 404;
//             ctx.body = {
//                 message : '포스트가 존재하지 않습니다.',
//             }
//             return;
//         }
//     posts.splice(index, 1);
//     ctx.status = 204; //no content
//     };
//     //index번째 아이템을 제거합니다.
  

//     // 포스트 수정(교체) PUT /api/posts/:id {title, body}
//     export const replace = ctx => {
//         //put 메서드는 전체 포스트 정보를 입력하여 데이터를 통째로 교체할 때 사용합니다. 
//        const { id } = ctx.params;
//        const index = posts.findIndex(p => p.id.toString() === id);
//        if( index === -1) {
//            ctx.status = 404;
//            ctx.body = {
//                message : '포스트가 존재ㅏ지 않습니다.',
//            }
//            return;
//        }
//         // 전체 객체를 덮어 씌웁니다.
//         // 따라서 id를 제외한 기존 정보를 날리고 객체를 새로 만듭니다.
//        posts[index] = {
//            id,
//            ...ctx.request.body,
//        };
//        ctx.body = posts[index];
//    }

//     // 포스트 수정(특정 필드 변경) PATCH /api/posts/:id {title, body}

//     export const update = ctx => {
//         //patch 메서드는 주어진 필드만 교체합니다. 
//        const { id } = ctx.params;
//         // 해당 id를 가진 post가 몇 번째인지 확인합니다.
//         const index = posts.findIndex(p => p.id.toString() === id)
//         if(index === -1){
//             ctx.status = 404;
//             ctx.body = {
//                 message : '포스트가 존재하지 않습니다.'
//             }
//             return;
//         }
//         // 기존 값에 정보를 덮어 씌웁니다.
//         posts[index] = {
//             ...posts[index],
//             ...ctx.request.body,
//         };
//         ctx.body = posts[index];
//     }
