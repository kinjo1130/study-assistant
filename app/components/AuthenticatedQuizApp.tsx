"use client"
import { useAuth } from "@/hooks/useAuth";
// import { useQuizHistory } from "@/hooks/useQuizHistory";
import  QuizApp  from "./QuizApp";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
// import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { GoogleSignInButton } from "@/components/ui/GoogleSigninButton";
// import { EmptyState } from "@/components/ui/empty-state";
// import { QuizHistoryItem } from "@/components/ui/quiz-history-item";

export function AuthenticatedQuizApp() {
  const { user, loading: authLoading, signIn, signOut } = useAuth();
  // const { histories, loading: historyLoading } = useQuizHistory();

  if (authLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">AI Study Assistant</h1>
        <p className="text-gray-600">サインインして学習を始めましょう</p>
        <GoogleSignInButton onClick={signIn} />
      </div>
    );
  }

  return (
    <div className="h-screen p-4">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">AI Study Assistant</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {user.photoURL && (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || ''} 
                  className="w-8 h-8 rounded-full"
                />
              )}
              <span className="text-sm text-gray-600">{user.email}</span>
            </div>
            <Button variant="outline" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>

        <Tabs defaultValue="quiz">
          <TabsList>
            <TabsTrigger value="quiz">クイズ作成</TabsTrigger>
            <TabsTrigger value="history">履歴</TabsTrigger>
          </TabsList>
          <TabsContent value="quiz">
            <QuizApp />
          </TabsContent>
          {/* <TabsContent value="history">
            <ScrollArea className="h-[calc(100vh-200px)] rounded-md border p-4">
              {historyLoading ? (
                <LoadingSpinner />
              ) : histories.length === 0 ? (
                <EmptyState message="履歴がありません" />
              ) : (
                <div className="space-y-8">
                  {histories.map((history) => (
                    <QuizHistoryItem key={history.id} history={history} />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent> */}
        </Tabs>
      </div>
    </div>
  );
}