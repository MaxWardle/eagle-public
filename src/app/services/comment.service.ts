import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { flatMap, mergeMap } from 'rxjs/operators';
import { of, forkJoin } from 'rxjs';
import 'rxjs/add/operator/toPromise';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/catch';
import * as _ from 'lodash';

import { ApiService } from './api';
import { Comment } from 'app/models/comment';
import { DocumentService } from './document.service';

@Injectable()
export class CommentService {
  private comment: Comment = null;

  constructor(
    private api: ApiService,
    private documentService: DocumentService,
  ) { }

  // get count of projects
  getCountById(commentPeriodId: string): Observable<number> {
    return this.api.getCountCommentsById(commentPeriodId)
      .catch(error => this.api.handleError(error));
  }

  // get all comments for the specified comment period id
  // (without documents)
  getByPeriodId(periodId: string, pageNum: number = null, pageSize: number = null, getCount: boolean = false): Observable <Comment[]> {
    return this.api.getCommentsByPeriodId(pageNum ? pageNum - 1 : pageNum, pageSize, getCount, periodId)
    .map((res: any) => {
      if (res) {
        let comments: Comment[] = [];
        if (!res || res.length === 0) {
          return { totalCount: 0, data: [] };
          // return [];
        }
        res.forEach(c => {
          comments.push(new Comment(c));
        });
        return { totalCount: res.length, data: comments };
        // return comments;
      }
      return {};
    })
    .catch(error => this.api.handleError(error));
  }

  // get a specific comment by its id
  // (including documents)
  getById(commentId: string, forceReload: boolean = false): Observable<Comment> {
    if (this.comment && this.comment._id === commentId && !forceReload) {
      return Observable.of(this.comment);
    }

    // first get the comment data
    return this.api.getComment(commentId)
    .pipe(
      flatMap(res => {
        let comments = res.body;
        if (!comments || comments.length === 0) {
          return of(null as Comment);
        }
        // Safety check for null documents or an empty array of documents.
        if (comments[0].documents === null || comments[0].documents && comments[0].documents.length === 0) {
          return of(new Comment(comments[0]));
        }
        // now get the rest of the data for this project
        return this._getExtraAppData(new Comment(comments[0]));
      })
    )
    .catch(error => this.api.handleError(error));
  }

  add(orig: Comment): Observable<Comment> {
    // make a (deep) copy of the passed-in comment so we don't change it
    const comment = _.cloneDeep(orig);

    // ID must not exist on POST
    delete comment._id;

    // don't send documents
    // delete comment.documents;

    // // replace newlines with \\n (JSON format)
    // if (comment.comment) {
    //   comment.comment = comment.comment.replace(/\n/g, '\\n');
    // }
    // if (comment.review && comment.review.reviewerNotes) {
    //   comment.review.reviewerNotes = comment.review.reviewerNotes.replace(/\n/g, '\\n');
    // }

    return this.api.addComment(comment)
      .map((res: Comment) => {
        return res ? new Comment(res) : null;
      })
      .catch(this.api.handleError);
  }

  private _getExtraAppData(comment: Comment): Observable<Comment> {
    return forkJoin(
      this.documentService.getByMultiId(comment.documents)
    ).map(payloads => {
      comment.documentsList = payloads[0];
      return comment;
    });
  }
}
